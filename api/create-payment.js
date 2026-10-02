import { randomUUID } from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const {
      sourceId,
      amount,
      items,
      shipping,
      coupon,
      customer
    } = req.body || {};

    // -----------------------------
    // 基本チェック
    // -----------------------------
    if (!sourceId) {
      return res.status(400).json({
        error: "sourceId is required"
      });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    // -----------------------------
    // Square環境変数
    // -----------------------------
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const environment =
      process.env.SQUARE_ENVIRONMENT || "sandbox";

    if (!accessToken || !locationId) {
      console.error("Square environment variables missing", {
        accessTokenExists: !!accessToken,
        locationIdExists: !!locationId,
        environment
      });

      return res.status(500).json({
        error: "Square environment variables are not configured"
      });
    }

    // -----------------------------
    // 注文番号を作成
    // -----------------------------
    const orderId =
      "SCH-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      randomUUID().slice(0, 6).toUpperCase();

    // -----------------------------
    // 注文情報を整理
    // -----------------------------
    const order = {
      orderId,
      createdAt: new Date().toISOString(),

      items: Array.isArray(items)
        ? items.map((item) => ({
            name: String(item.name || ""),
            price: Number(item.price || 0),
            size: String(item.size || ""),
            quantity: Number(item.quantity || 1)
          }))
        : [],

      shipping: Number(shipping || 0),
      coupon: String(coupon || ""),
      amount,

      customer: customer
        ? {
            name: String(customer.name || ""),
            email: String(customer.email || ""),
            postalCode: String(customer.postalCode || ""),
            address: String(customer.address || ""),
            phone: String(customer.phone || "")
          }
        : null
    };

    console.log(
      "New Schön! order:",
      JSON.stringify(order, null, 2)
    );

    // -----------------------------
    // Square API
    // -----------------------------
    const squareUrl =
      environment === "production"
        ? "https://connect.squareup.com/v2/payments"
        : "https://connect.squareupsandbox.com/v2/payments";

    console.log("Sending payment request to Square", {
      environment,
      amount,
      locationId,
      orderId
    });

    const response = await fetch(squareUrl, {
      method: "POST",

      headers: {
        "Square-Version": "2026-09-16",
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        idempotency_key: randomUUID(),

        source_id: sourceId,

        amount_money: {
          amount,
          currency: "JPY"
        },

        location_id: locationId,

        autocomplete: true,

        note: `Schön! Order ${orderId}`
      })
    });

    const data = await response.json();

    // -----------------------------
    // Squareエラー
    // -----------------------------
    if (!response.ok) {
      console.error(
        "Square API error:",
        JSON.stringify(data)
      );

      return res.status(response.status).json({
        error: data
      });
    }

    // -----------------------------
    // 決済成功
    // -----------------------------
    console.log(
      "Square payment successful:",
      data.payment?.id
    );

    return res.status(200).json({
      success: true,

      order: {
        orderId,
        createdAt: order.createdAt,
        items: order.items,
        shipping: order.shipping,
        coupon: order.coupon,
        amount: order.amount,
        customer: order.customer
      },

      payment: {
        id: data.payment?.id,
        status: data.payment?.status,
        amount: data.payment?.amount_money
      }
    });

  } catch (error) {
    console.error(
      "Payment processing error:",
      error
    );

    return res.status(500).json({
      error: "Payment processing failed",
      detail: error.message || String(error)
    });
  }
}
