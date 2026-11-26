package dev.lightstart.mobile.addons

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import dev.lightstart.mobile.MainActivity
import dev.lightstart.mobile.MobileAddon
import org.json.JSONArray
import org.json.JSONObject

/**
 * The `play` family: Google Play subscriptions for the plans a project sells,
 * the product ids being the plan ids.
 *
 *   PLAY:PRODUCTS [{ ids }]              -> [{ id, price, trialDays }] as Play states them here
 *   PLAY:BUY      [{ productId, accountId }] -> { purchaseToken, productId } once Play takes it
 *
 * The purchase is only handed back: the server reads it from Play, checks the
 * account id is the caller's, grants it and acknowledges it.
 */
class PlayBillingAddon : MobileAddon, PurchasesUpdatedListener {
    override val families: List<String> = listOf("play")

    private var activity: MainActivity? = null
    private var client: BillingClient? = null
    private val details = mutableMapOf<String, ProductDetails>()
    private var buying: Pair<(Any?) -> Unit, (String) -> Unit>? = null

    override fun onCreate(activity: MainActivity, root: android.widget.FrameLayout, webView: android.webkit.WebView) {
        this.activity = activity
        client = BillingClient.newBuilder(activity)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
    }

    override fun onDestroy() {
        buying = null
        details.clear()
        client?.endConnection()
        client = null
        activity = null
    }

    override fun handle(method: String, args: JSONArray, respond: (Any?) -> Unit, fail: (String) -> Unit): Boolean {
        if (!method.startsWith("PLAY:")) return false
        when (method) {
            PLAY_PRODUCTS -> ready({ products(args.optJSONObject(0), respond, fail) }, fail)
            PLAY_BUY -> ready({ buy(args.optJSONObject(0), respond, fail) }, fail)
            else -> fail("unknown play message: $method")
        }
        return true
    }

    private fun ready(then: () -> Unit, fail: (String) -> Unit) {
        val billing = client
        if (billing == null) {
            fail("play-unavailable")
            return
        }
        if (billing.isReady) {
            then()
            return
        }
        billing.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) then() else fail("play-unavailable")
            }

            override fun onBillingServiceDisconnected() {}
        })
    }

    private fun offerOf(product: ProductDetails): ProductDetails.SubscriptionOfferDetails? {
        val offers = product.subscriptionOfferDetails ?: return null
        return offers.firstOrNull { offer -> offer.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L } } ?: offers.firstOrNull()
    }

    private val periodDays = mapOf('D' to 1, 'W' to 7, 'M' to 30)

    private fun daysOf(period: String): Int {
        val match = Regex("^P(\\d+)([DWM])$").find(period) ?: return 0
        return match.groupValues[1].toInt() * (periodDays[match.groupValues[2].first()] ?: 0)
    }

    private fun products(payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val billing = client ?: return fail("play-unavailable")
        val ids = payload?.optJSONArray("ids") ?: JSONArray()
        val wanted = (0 until ids.length()).map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(ids.getString(it)).setProductType(BillingClient.ProductType.SUBS).build()
        }
        if (wanted.isEmpty()) return respond(JSONArray())
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(wanted).build()) { result, found ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) return@queryProductDetailsAsync fail("play-products")
            val out = JSONArray()
            for (product in found.productDetailsList) {
                details[product.productId] = product
                val phases = offerOf(product)?.pricingPhases?.pricingPhaseList ?: continue
                val recurring = phases.lastOrNull { it.priceAmountMicros > 0 } ?: continue
                val trial = phases.firstOrNull { it.priceAmountMicros == 0L }
                out.put(JSONObject().put("id", product.productId).put("price", recurring.formattedPrice).put("trialDays", trial?.let { daysOf(it.billingPeriod) } ?: 0))
            }
            respond(out)
        }
    }

    private fun buy(payload: JSONObject?, respond: (Any?) -> Unit, fail: (String) -> Unit) {
        val billing = client ?: return fail("play-unavailable")
        val activity = this.activity ?: return fail("play-unavailable")
        val product = details[payload?.optString("productId").orEmpty()] ?: return fail("play-unknown-product")
        val offer = offerOf(product) ?: return fail("play-no-offer")
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offer.offerToken).build(),
                ),
            )
            .setObfuscatedAccountId(payload?.optString("accountId").orEmpty().take(64))
            .build()
        buying = respond to fail
        activity.runOnUiThread {
            val result = billing.launchBillingFlow(activity, params)
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                buying = null
                fail("play-launch")
            }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        val (respond, fail) = buying ?: return
        buying = null
        val purchase = purchases?.firstOrNull()
        when {
            result.responseCode == BillingClient.BillingResponseCode.OK && purchase != null ->
                respond(JSONObject().put("purchaseToken", purchase.purchaseToken).put("productId", purchase.products.firstOrNull().orEmpty()))
            result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED -> fail("play-canceled")
            else -> fail("play-failed")
        }
    }

    companion object {
        const val PLAY_PRODUCTS = "PLAY:PRODUCTS"
        const val PLAY_BUY = "PLAY:BUY"
    }
}
