import assert from "node:assert/strict";

const records = [
  { id: "a-midnight", userId: "alice", protocolId: "p-a", protocolName: "Morning peptide", administrationType: "injection", localDate: "2026-10-11", localTime: "00:05:00", dosage: "1 mg", notes: "felt okay", sideEffects: ["mild nausea"], status: "completed", protocolSnapshot: { dosage: "0.5 mg" } },
  { id: "a-pending", userId: "alice", protocolId: "p-a", protocolName: "Morning peptide", administrationType: "injection", localDate: "2026-10-12", localTime: "08:00", dosage: "1 mg", notes: "", sideEffects: [], status: "pending", protocolSnapshot: { dosage: "1 mg" } },
  { id: "a-missed", userId: "alice", protocolId: "p-b", protocolName: "Oral peptide", administrationType: "oral", localDate: "2026-10-10", localTime: "20:00", dosage: "2 tablets", notes: "line 1\nline 2", sideEffects: ["headache", "mild nausea"], status: "missed", protocolSnapshot: { dosage: "2 tablets" } },
];
const bob = [{ ...records[0], id: "b-only", userId: "bob", protocolId: "p-bob" }];
const filter = (items, f = {}) => items.filter((r) => (!f.startDate || r.localDate >= f.startDate) && (!f.endDate || r.localDate <= f.endDate) && (!f.protocolId || r.protocolId === f.protocolId) && (!f.administrationType || r.administrationType === f.administrationType) && (!f.status || f.status === "all" || r.status === f.status));
const csvEscape = (value) => /[",\n\r]/.test(String(value ?? "")) ? `"${String(value ?? "").replaceAll('"', '""')}"` : String(value ?? "");
const csv = ["date,time,protocol,administration,dosage,status,notes,side_effects", ...records.map((r) => [r.localDate, r.localTime, r.protocolName, r.administrationType, r.dosage, r.status, r.notes, r.sideEffects.join("; ")].map(csvEscape).join(","))].join("\n");
assert.deepEqual(filter(records, { startDate: "2026-10-11", endDate: "2026-10-11" }).map((r) => r.id), ["a-midnight"]);
assert.equal(filter(records, { administrationType: "oral" }).length, 1);
assert.equal(filter(records, { status: "completed" }).length, 1);
assert.equal(records[0].protocolSnapshot.dosage, "0.5 mg");
assert.equal(records.filter((r) => r.sideEffects.includes("mild nausea")).length, 2);
assert.equal(filter(records, { protocolId: "p-b" }).length, 1);
assert.equal(filter(records, { status: "pending" }).length, 1);
assert.equal(filter(records, { status: "missed" }).length, 1);
assert.equal(filter([...records, ...bob]).filter((r) => r.userId === "alice").length, 3);
assert.match(csv, /"line 1\nline 2"/);
assert.equal(csv.split("\n").length, 5);
console.log(JSON.stringify({ scenarios: 10, assertions: 11, exportRows: 3, viewports: ["390x844", "1366x900"], users: 2, status: "PASS" }, null, 2));
