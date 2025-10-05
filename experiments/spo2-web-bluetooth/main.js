const PLX_SERVICE_UUID = 0x1822;
const SPOT_CHECK_MEASUREMENT_CHAR_UUID = 0x2a5e;
const CONTINUOUS_MEASUREMENT_CHAR_UUID = 0x2a5f;
const PLX_FEATURES_CHAR_UUID = 0x2a60;

const connectSpotButton = document.getElementById('connect-spot');
const connectContinuousButton = document.getElementById('connect-continuous');
const disconnectButton = document.getElementById('disconnect');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const spo2El = document.getElementById('spo2-value');
const pulseEl = document.getElementById('pulse-value');
const pviEl = document.getElementById('pvi-value');
const timestampEl = document.getElementById('timestamp-value');

let bluetoothDevice;
let measurementCharacteristic;
let currentMode;

const supportsWebBluetooth = 'bluetooth' in navigator;

if (!supportsWebBluetooth) {
  setStatus('Web Bluetooth is not available in this browser. Try Chrome or Edge on desktop, or Chrome on Android.');
  connectSpotButton.disabled = true;
  connectContinuousButton.disabled = true;
  disconnectButton.disabled = true;
}

if (connectSpotButton) {
  connectSpotButton.addEventListener('click', function () {
    connectAndSubscribe('spot');
  });
}

if (connectContinuousButton) {
  connectContinuousButton.addEventListener('click', function () {
    connectAndSubscribe('continuous');
  });
}

if (disconnectButton) {
  disconnectButton.addEventListener('click', function () {
    disconnect('Manual disconnect');
  });
}

async function connectAndSubscribe(mode) {
  if (!supportsWebBluetooth) {
    return;
  }
  try {
    await disconnect();
    currentMode = mode;
    disableConnectButtons(true);
    setStatus('Requesting Zacurate device…');

    const requestedCharacteristic = mode === 'continuous'
      ? CONTINUOUS_MEASUREMENT_CHAR_UUID
      : SPOT_CHECK_MEASUREMENT_CHAR_UUID;

    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PLX_SERVICE_UUID] }],
      optionalServices: [PLX_SERVICE_UUID],
    });

    bluetoothDevice.addEventListener('gattserverdisconnected', function () {
      appendLog('Device disconnected');
      disableConnectButtons(false);
      disconnectButton.disabled = true;
      setStatus('Device disconnected');
    });

    setStatus('Connecting to GATT server…');
    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(PLX_SERVICE_UUID);

    try {
      const features = await service.getCharacteristic(PLX_FEATURES_CHAR_UUID);
      const value = await features.readValue();
      appendLog('PLX Features: ' + bufferToHex(value));
    } catch (err) {
      appendLog('PLX Features characteristic not available (continuing).');
    }

    measurementCharacteristic = await service.getCharacteristic(requestedCharacteristic);

    await measurementCharacteristic.startNotifications();
    measurementCharacteristic.addEventListener('characteristicvaluechanged', handleMeasurement);

    disconnectButton.disabled = false;
    const modeLabel = mode === 'continuous' ? 'continuous' : 'spot-check';
    setStatus('Subscribed to ' + modeLabel + ' measurement notifications.');
    appendLog('Listening for measurements…');
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    appendLog('Error: ' + message);
    setStatus('Failed to connect. See log.');
    disableConnectButtons(false);
    await disconnect();
  }
}

async function disconnect(reason = 'Disconnected') {
  if (measurementCharacteristic) {
    try {
      await measurementCharacteristic.stopNotifications();
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      appendLog('stopNotifications failed: ' + message);
    }
    measurementCharacteristic.removeEventListener('characteristicvaluechanged', handleMeasurement);
    measurementCharacteristic = null;
  }

  if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
  bluetoothDevice = null;
  currentMode = undefined;
  setStatus(reason);
  disconnectButton.disabled = true;
  disableConnectButtons(false);
}

function handleMeasurement(event) {
  const dataView = event.target.value;
  let parsed;
  try {
    parsed = currentMode === 'continuous'
      ? parseContinuousMeasurement(dataView)
      : parseSpotMeasurement(dataView);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    appendLog('Parse error: ' + message);
    return;
  }

  const spo2Display = isFinite(parsed.spo2) ? parsed.spo2.toFixed(1) : 'n/a';
  const pulseDisplay = isFinite(parsed.pulseRate) ? parsed.pulseRate.toFixed(1) : 'n/a';
  const paiDisplay = isFinite(parsed.pulseAmplitudeIndex) ? parsed.pulseAmplitudeIndex.toFixed(1) : 'n/a';
  const timestampDisplay = parsed.timestamp ? parsed.timestamp.toLocaleString() : '—';

  spo2El.textContent = spo2Display;
  pulseEl.textContent = pulseDisplay;
  pviEl.textContent = paiDisplay;
  timestampEl.textContent = timestampDisplay;

  appendLog(formatMeasurementLog(parsed));
}

function parseContinuousMeasurement(dataView) {
  if (dataView.byteLength < 5) {
    throw new Error('Continuous measurement payload too short');
  }
  const flags = dataView.getUint8(0);
  let offset = 1;
  const spo2 = readSFloat(dataView, offset);
  offset += 2;
  const pulseRate = readSFloat(dataView, offset);
  offset += 2;

  let measurementStatus;
  if (flags & 0x01) {
    measurementStatus = dataView.getUint16(offset, true);
    offset += 2;
  }

  let deviceAndSensorStatus;
  if (flags & 0x02) {
    deviceAndSensorStatus = readUint24(dataView, offset);
    offset += 3;
  }

  let pulseAmplitudeIndex = Number.NaN;
  if (flags & 0x04 && dataView.byteLength >= offset + 2) {
    pulseAmplitudeIndex = readSFloat(dataView, offset);
  }

  return {
    mode: 'continuous',
    flags: flags,
    spo2: spo2,
    pulseRate: pulseRate,
    measurementStatus: measurementStatus,
    deviceAndSensorStatus: deviceAndSensorStatus,
    pulseAmplitudeIndex: pulseAmplitudeIndex,
    timestamp: new Date(),
  };
}

function parseSpotMeasurement(dataView) {
  if (dataView.byteLength < 6) {
    throw new Error('Spot-check measurement payload too short');
  }
  const flags = dataView.getUint16(0, true);
  let offset = 2;
  const spo2 = readSFloat(dataView, offset);
  offset += 2;
  const pulseRate = readSFloat(dataView, offset);
  offset += 2;

  let timestamp;
  if (flags & 0x0001) {
    timestamp = readDateTime(dataView, offset);
    offset += 7;
  }

  let measurementStatus;
  if (flags & 0x0002) {
    measurementStatus = dataView.getUint16(offset, true);
    offset += 2;
  }

  let deviceAndSensorStatus;
  if (flags & 0x0004) {
    deviceAndSensorStatus = readUint24(dataView, offset);
    offset += 3;
  }

  let pulseAmplitudeIndex = Number.NaN;
  if (flags & 0x0008 && dataView.byteLength >= offset + 2) {
    pulseAmplitudeIndex = readSFloat(dataView, offset);
  }

  return {
    mode: 'spot',
    flags: flags,
    spo2: spo2,
    pulseRate: pulseRate,
    measurementStatus: measurementStatus,
    deviceAndSensorStatus: deviceAndSensorStatus,
    pulseAmplitudeIndex: pulseAmplitudeIndex,
    timestamp: timestamp,
  };
}

function readSFloat(dataView, offset) {
  const raw = dataView.getUint16(offset, true);
  if (raw === 0x07ff) {
    return Number.NaN;
  }
  let mantissa = raw & 0x0fff;
  let exponent = raw >> 12;
  if (mantissa & 0x0800) {
    mantissa = mantissa - 0x1000;
  }
  if (exponent & 0x0008) {
    exponent = exponent - 0x0010;
  }
  return mantissa * Math.pow(10, exponent);
}

function readUint24(dataView, offset) {
  return dataView.getUint8(offset)
    | (dataView.getUint8(offset + 1) << 8)
    | (dataView.getUint8(offset + 2) << 16);
}

function readDateTime(dataView, offset) {
  const year = dataView.getUint16(offset, true);
  const month = dataView.getUint8(offset + 2);
  const day = dataView.getUint8(offset + 3);
  const hours = dataView.getUint8(offset + 4);
  const minutes = dataView.getUint8(offset + 5);
  const seconds = dataView.getUint8(offset + 6);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function formatMeasurementLog(measurement) {
  const parts = [];
  const label = measurement.mode === 'continuous' ? 'Continuous' : 'Spot';
  parts.push('[' + new Date().toLocaleTimeString() + '] ' + label + ' measurement');
  if (isFinite(measurement.spo2)) {
    parts.push('  SpO2: ' + measurement.spo2.toFixed(1) + ' %');
  }
  if (isFinite(measurement.pulseRate)) {
    parts.push('  Pulse: ' + measurement.pulseRate.toFixed(1) + ' bpm');
  }
  if (isFinite(measurement.pulseAmplitudeIndex)) {
    parts.push('  Pulse Amp Index: ' + measurement.pulseAmplitudeIndex.toFixed(1));
  }
  if (measurement.measurementStatus !== undefined) {
    parts.push('  Measurement Status: 0x' + measurement.measurementStatus.toString(16).padStart(4, '0'));
  }
  if (measurement.deviceAndSensorStatus !== undefined) {
    parts.push('  Device/Sensor Status: 0x' + measurement.deviceAndSensorStatus.toString(16).padStart(6, '0'));
  }
  if (measurement.timestamp) {
    parts.push('  Sample Time: ' + measurement.timestamp.toLocaleString());
  }
  return parts.join('\n');
}

function appendLog(message) {
  const time = new Date().toLocaleTimeString();
  const prefix = time + ' | ';
  const current = logEl.textContent ? logEl.textContent : '';
  logEl.textContent = prefix + message + '\n' + current;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function disableConnectButtons(disabled) {
  connectSpotButton.disabled = disabled;
  connectContinuousButton.disabled = disabled;
}

function bufferToHex(dataView) {
  const arr = [];
  for (let i = 0; i < dataView.byteLength; i += 1) {
    arr.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
  }
  return '0x' + arr.join(' ');
}

window.addEventListener('beforeunload', function () {
  if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
});
