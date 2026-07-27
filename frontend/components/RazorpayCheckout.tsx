import React, { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Modal, Text, TouchableOpacity } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import type { BackendPaymentOrder } from '../services/payments.service';

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface Props {
  visible: boolean;
  order: BackendPaymentOrder | null;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (result: RazorpaySuccess) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

/**
 * Razorpay Checkout hosted in a WebView.
 *
 * React Native has no Razorpay web SDK, so the standard checkout page is
 * loaded inside a WebView and its handler posts the signed result back over
 * the RN bridge. The signature returned here is the real one — it is verified
 * server-side against the key secret, which is what makes this safe to trust.
 *
 * Callers must short-circuit to /verify when the backend returns a mock order
 * (see `isMockOrder`); rendering this against a placeholder key just 401s.
 */
export const RazorpayCheckout: React.FC<Props> = ({
  visible,
  order,
  description,
  prefill,
  onSuccess,
  onCancel,
  onError,
}) => {
  const html = useMemo(() => {
    if (!order) return '';
    // Values are JSON-encoded rather than interpolated raw so a quote or
    // newline in a name/description can't break out of the script.
    const options = JSON.stringify({
      key: order.razorpay_key_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      order_id: order.razorpay_order_id,
      name: 'NurseConnect',
      description,
      prefill: prefill ?? {},
      theme: { color: Colors.primary },
    });

    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  </head>
  <body style="margin:0;background:#F8FAFC">
    <script>
      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      try {
        var options = ${options};
        options.handler = function (response) {
          post({ type: 'success', data: response });
        };
        options.modal = {
          ondismiss: function () { post({ type: 'cancel' }); },
          escape: false,
          backdropclose: false
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
          post({ type: 'error', message: (response && response.error && response.error.description) || 'Payment failed' });
        });
        rzp.open();
      } catch (e) {
        post({ type: 'error', message: (e && e.message) || 'Could not open checkout' });
      }
    </script>
  </body>
</html>`;
  }, [order, description, prefill]);

  const handleMessage = (event: WebViewMessageEvent) => {
    let payload: any;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (payload?.type === 'success' && payload.data) {
      const d = payload.data;
      if (d.razorpay_order_id && d.razorpay_payment_id && d.razorpay_signature) {
        onSuccess({
          razorpay_order_id: d.razorpay_order_id,
          razorpay_payment_id: d.razorpay_payment_id,
          razorpay_signature: d.razorpay_signature,
        });
      } else {
        onError('Payment gateway returned an incomplete response.');
      }
    } else if (payload?.type === 'cancel') {
      onCancel();
    } else if (payload?.type === 'error') {
      onError(payload.message || 'Payment failed');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.bar}>
          <TouchableOpacity onPress={onCancel} testID="razorpay-close" style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.barTitle}>Secure payment</Text>
          <View style={styles.closeBtn} />
        </View>
        {order ? (
          <WebView
            source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMessage}
            onError={() => onError('Could not reach the payment gateway.')}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            )}
            style={{ flex: 1 }}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgApp },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 52,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  barTitle: { ...Typography.h4, color: Colors.textPrimary },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
