
import { randomUUID } from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const { sourceId, amount } = req.body || {};

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

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const environment = process.env.SQUARE_ENVIRONMENT || "sandbox";

    if (!accessToken || !locationId) {
      console.error("Square environment variables missing", {
        accessTokenExists: !!accessToken,
        locationIdExists: !!locationId,
        environment
      });

      return res.status(500).json({
        error: "Square environment variables are not configured",
        accessTokenExists: !!accessToken,
        locationIdExists: !!locationId,
        environment
      });
    }

    const squareUrl =
      environment === "production"
        ? "https://connect.squareup.com/v2/payments"
        : "https://connect.squareupsandbox.com/v2/payments";

    console.log("Sending payment request to Square", {
      environment,
      amount,
      locationId
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
        autocomplete: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Square API error:", JSON.stringify(data));

      return res.status(response.status).json({
        error: data
      });
    }

    return res.status(200).json({
      success: true,
      payment: data.payment
    });

  } catch (error) {
    console.error("Payment processing error:", error);

    return res.status(500).json({
      error: "Payment processing failed",
      detail: error.message || String(error)
    });
  }
}
