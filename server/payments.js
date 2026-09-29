const express = require('express');
const crypto = require('crypto');

/**
 * Payment processing module supporting multiple payment providers
 */
class PaymentService {
  constructor() {
    this.providers = new Map();
    this.webhookHandlers = new Map();
  }

  /**
   * Register a payment provider
   */
  registerProvider(name, config) {
    this.providers.set(name, config);
  }

  /**
   * Create a checkout session
   */
  async createCheckout(options) {
    const { provider, amount, currency = 'USD', orderId, successUrl, cancelUrl, metadata = {} } = options;

    if (!provider) {
      throw new Error('Payment provider is required');
    }

    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`Payment provider '${provider}' not configured`);
    }

    // Simulate checkout session creation
    const checkoutSession = {
      id: `checkout_${crypto.randomBytes(16).toString('hex')}`,
      provider,
      amount,
      currency,
      orderId,
      status: 'pending',
      url: `https://checkout.${provider}.com/pay/${crypto.randomBytes(8).toString('hex')}`,
      successUrl,
      cancelUrl,
      metadata,
      createdAt: new Date().toISOString()
    };

    return checkoutSession;
  }

  /**
   * Attach payment webhook routes to Express app
   * MUST be called before body parser middleware
   */
  attachPaymentWebhooks(app) {
    // Webhook endpoint with raw body parsing for signature verification
    app.post('/webhooks/payments/:provider', 
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const { provider } = req.params;
        
        try {
          const handler = this.webhookHandlers.get(provider);
          if (!handler) {
            console.warn(`[payments] No webhook handler for provider: ${provider}`);
            return res.status(404).json({ error: 'Provider not found' });
          }

          // Verify webhook signature (provider-specific)
          const signature = req.headers['x-webhook-signature'] || req.headers['stripe-signature'];
          const isValid = await this.verifyWebhookSignature(provider, req.body, signature);
          
          if (!isValid) {
            console.error(`[payments] Invalid webhook signature for ${provider}`);
            return res.status(401).json({ error: 'Invalid signature' });
          }

          // Parse and handle webhook event
          const event = JSON.parse(req.body.toString());
          await handler(event);
          
          res.json({ received: true });
        } catch (err) {
          console.error(`[payments] Webhook error for ${provider}:`, err.message);
          res.status(400).json({ error: err.message });
        }
      }
    );

    console.log('[payments] Payment webhooks attached');
  }

  /**
   * Attach payment-related routes to Express app
   */
  attachPaymentRoutes(app, options = {}) {
    const { getUser } = options;

    // Create checkout endpoint
    app.post('/api/payments/checkout', async (req, res) => {
      try {
        let user = null;
        if (getUser) {
          try {
            user = await getUser(req);
          } catch (err) {
            console.error('[payments] getUser failed:', err.message);
          }
        }

        const { provider, amount, currency, orderId, metadata } = req.body;
        
        if (!provider || !amount) {
          return res.status(400).json({ error: 'Provider and amount are required' });
        }

        const checkout = await this.createCheckout({
          provider,
          amount,
          currency,
          orderId,
          successUrl: req.body.successUrl || `${req.protocol}://${req.get('host')}/payment/success`,
          cancelUrl: req.body.cancelUrl || `${req.protocol}://${req.get('host')}/payment/cancel`,
          metadata: {
            ...metadata,
            userId: user?.id
          }
        });

        res.json({ checkout });
      } catch (err) {
        console.error('[payments] Checkout creation failed:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // Get payment status endpoint
    app.get('/api/payments/:checkoutId/status', async (req, res) => {
      try {
        const { checkoutId } = req.params;
        
        // Simulate status retrieval
        const status = {
          id: checkoutId,
          status: 'completed',
          updatedAt: new Date().toISOString()
        };

        res.json({ status });
      } catch (err) {
        console.error('[payments] Status check failed:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    console.log('[payments] Payment routes attached');
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(provider, body, signature) {
    if (!signature) {
      return false;
    }

    const providerConfig = this.providers.get(provider);
    if (!providerConfig || !providerConfig.webhookSecret) {
      console.warn(`[payments] No webhook secret configured for ${provider}`);
      return true; // Allow in development
    }

    // Implement provider-specific signature verification
    const expectedSignature = crypto
      .createHmac('sha256', providerConfig.webhookSecret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Register a webhook handler for a provider
   */
  onWebhook(provider, handler) {
    this.webhookHandlers.set(provider, handler);
  }
}

// Export singleton instance
const payments = new PaymentService();

module.exports = payments;
