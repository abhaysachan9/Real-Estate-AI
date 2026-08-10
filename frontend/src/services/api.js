const API_URL = "https://real-estate-ai-f4ma.onrender.com";

export async function predictPrice(propertyData) {
  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(propertyData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Prediction failed");
    }

    return data;
  } catch (error) {
    console.error("Prediction API Error:", error);
    throw error;
  }
}