'use client';

import { useEffect, useState } from 'react';
import { Package, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Order {
  id: string;
  stripeSessionId: string;
  email: string;
  productName: string;
  productSlug?: string;
  amountTotal: number;
  currency: string;
  status: string;
  fulfillmentStatus: string;
  shippingName: string;
  shippingLine1: string;
  shippingLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Edit order states
  const [editFulfillmentStatus, setEditFulfillmentStatus] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editTrackingUrl, setEditTrackingUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/admin/orders');
      const data = await response.json();

      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setEditFulfillmentStatus(order.fulfillmentStatus);
    setEditTrackingNumber(order.trackingNumber || '');
    setEditTrackingUrl(order.trackingUrl || '');
    setEditNotes(order.notes || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedOrder(null);
  };

  const updateOrder = async () => {
    if (!selectedOrder) return;

    setUpdating(true);

    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          fulfillmentStatus: editFulfillmentStatus,
          trackingNumber: editTrackingNumber || null,
          trackingUrl: editTrackingUrl || null,
          notes: editNotes || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Order updated successfully!');
        closeModal();
        loadOrders(); // Reload orders
      } else {
        alert('Failed to update order: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      alert('Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (fulfillmentStatus: string) => {
    switch (fulfillmentStatus) {
      case 'unfulfilled':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'processing':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'shipped':
        return <Truck className="w-5 h-5 text-purple-500" />;
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadgeColor = (fulfillmentStatus: string) => {
    switch (fulfillmentStatus) {
      case 'unfulfilled':
        return 'bg-amber-100 text-amber-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600 mt-2">{orders.length} total orders</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h2>
            <p className="text-gray-600">Orders will appear here once customers make purchases.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          #{order.id.slice(-8).toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.shippingName}</div>
                        <div className="text-sm text-gray-500">{order.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.productName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          ${(order.amountTotal / 100).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                            order.fulfillmentStatus
                          )}`}
                        >
                          {getStatusIcon(order.fulfillmentStatus)}
                          {order.fulfillmentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openOrderModal(order)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Order Detail Modal */}
        {showModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Order #{selectedOrder.id.slice(-8).toUpperCase()}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-light"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Order Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Product:</span>
                      <span className="font-medium">{selectedOrder.productName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-bold text-lg">
                        ${(selectedOrder.amountTotal / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span>{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span>{selectedOrder.email}</span>
                    </div>
                    {selectedOrder.shippingPhone && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span>{selectedOrder.shippingPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Shipping Address</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900">{selectedOrder.shippingName}</p>
                    <p className="text-gray-700">{selectedOrder.shippingLine1}</p>
                    {selectedOrder.shippingLine2 && (
                      <p className="text-gray-700">{selectedOrder.shippingLine2}</p>
                    )}
                    <p className="text-gray-700">
                      {selectedOrder.shippingCity}, {selectedOrder.shippingState}{' '}
                      {selectedOrder.shippingPostalCode}
                    </p>
                    <p className="text-gray-700">{selectedOrder.shippingCountry}</p>
                  </div>
                </div>

                {/* Fulfillment Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Fulfillment</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={editFulfillmentStatus}
                        onChange={(e) => setEditFulfillmentStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="unfulfilled">Unfulfilled</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tracking Number
                      </label>
                      <input
                        type="text"
                        value={editTrackingNumber}
                        onChange={(e) => setEditTrackingNumber(e.target.value)}
                        placeholder="e.g., 1Z999AA10123456784"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tracking URL
                      </label>
                      <input
                        type="url"
                        value={editTrackingUrl}
                        onChange={(e) => setEditTrackingUrl(e.target.value)}
                        placeholder="https://tools.usps.com/go/TrackConfirmAction?tLabels=..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                        placeholder="Internal notes..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={updateOrder}
                  disabled={updating}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : 'Update Order'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
