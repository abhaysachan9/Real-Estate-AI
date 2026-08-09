import { useState } from "react";
import { motion } from "framer-motion";

function PredictionForm({ onPrediction }) {
  const [formData, setFormData] = useState({
    total_sqft: "",
    bhk: "",
    bath: "",
    balcony: "",
    location: "",
  });

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  // Common locations from the Bengaluru dataset
  const locations = [
    "Electronic City",
    "Electronic City Phase II",
    "Electronic City Phase 1",
    "Whitefield",
    "HSR Layout",
    "BTM Layout",
    "BTM 2nd Stage",
    "JP Nagar",
    "JP Nagar 5th Phase",
    "JP Nagar 6th Phase",
    "JP Nagar 7th Phase",
    "JP Nagar 8th Phase",
    "JP Nagar 9th Phase",
    "Banashankari",
    "Banashankari Stage II",
    "Banashankari Stage III",
    "Banashankari Stage V",
    "Banashankari Stage VI",
    "Marathahalli",
    "Bellandur",
    "Sarjapur Road",
    "HSR",
    "Whitefield",
    "Brookefield",
    "Hoodi",
    "HBR Layout",
    "HRBR Layout",
    "Hebbal",
    "Yelahanka",
    "Rajaji Nagar",
    "Malleshwaram",
    "Indira Nagar",
    "Koramangala",
    "Kengeri",
    "Uttarahalli",
    "Kanakapura Road",
    "Bannerghatta Road",
    "Begur",
    "Bommanahalli",
    "Kudlu Gate",
    "Varthur",
    "Kadugodi",
    "Hennur",
    "Hennur Road",
    "Horamavu",
    "Ramamurthy Nagar",
    "Kalyan Nagar",
    "Jakkur",
    "Devanahalli",
    "Yeshwanthpur",
    "Tumkur Road",
    "CV Raman Nagar",
    "Frazer Town",
    "Richmond Town",
    "Cooke Town",
    "Cox Town",
    "Domlur",
    "Ulsoor",
    "Old Airport Road",
    "Basavanagudi",
    "Vijayanagar",
    "Nagarbhavi",
    "Rajarajeshwari Nagar",
    "Kumaraswami Layout",
    "Gottigere",
    "Akshaya Nagar",
    "Arekere",
    "Hulimavu",
    "Harlur",
    "Haralur Road",
    "Kasavanahalli",
    "Kothanur",
    "Nagawara",
    "RT Nagar",
    "Banaswadi",
    "Kalyan Nagar",
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    // Clear previous result when user changes details
    if (prediction !== null) {
      setPrediction(null);
    }
  };

  const handlePredict = async (e) => {
    e.preventDefault();

    if (!formData.location.trim()) {
      alert("Please enter or select a location.");
      return;
    }

    setLoading(true);
    setPrediction(null);

    try {
      const response = await fetch("http://127.0.0.1:5001/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          total_sqft: Number(formData.total_sqft),
          bhk: Number(formData.bhk),
          bath: Number(formData.bath),
          balcony: Number(formData.balcony),
          location: formData.location.trim(),
        }),
      });

      const data = await response.json();

      console.log("Prediction response:", data);

      if (data.status === "success") {
  setPrediction(data.predicted_price);

  onPrediction({
    total_sqft: Number(formData.total_sqft),
    bhk: Number(formData.bhk),
    bath: Number(formData.bath),
    balcony: Number(formData.balcony),
    location: formData.location.trim(),
    predicted_price: Number(data.predicted_price),
  });} else {
        alert(data.message || "Prediction failed.");
      }
    } catch (error) {
      console.error("Prediction error:", error);
      alert(
        "Unable to connect to the prediction server. Make sure Flask is running on port 5000."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="prediction"
      className="relative overflow-hidden bg-slate-950 px-6 py-32"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl">

        {/* ================= HEADER ================= */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.45em] text-cyan-400">
            AI PRICE ENGINE
          </p>

          <h2 className="text-4xl font-black text-white md:text-6xl">
            Predict Your
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Property Value
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-400">
            Enter your property details and let our machine learning model
            estimate the expected Bengaluru property price.
          </p>
        </motion.div>

        {/* ================= FORM CARD ================= */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl backdrop-blur-xl md:p-10"
        >
          <form
            onSubmit={handlePredict}
            className="grid gap-6 md:grid-cols-2"
          >

            {/* TOTAL AREA */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Total Area
              </label>

              <input
                type="number"
                name="total_sqft"
                value={formData.total_sqft}
                onChange={handleChange}
                placeholder="e.g. 1200"
                min="100"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />

              <p className="mt-2 text-xs text-slate-500">
                Area in square feet
              </p>
            </div>

            {/* BHK */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Bedrooms (BHK)
              </label>

              <input
                type="number"
                name="bhk"
                value={formData.bhk}
                onChange={handleChange}
                placeholder="e.g. 2"
                min="1"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            {/* BATHROOMS */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Bathrooms
              </label>

              <input
                type="number"
                name="bath"
                value={formData.bath}
                onChange={handleChange}
                placeholder="e.g. 2"
                min="1"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            {/* BALCONIES */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Balconies
              </label>

              <input
                type="number"
                name="balcony"
                value={formData.balcony}
                onChange={handleChange}
                placeholder="e.g. 2"
                min="0"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-5 text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            {/* ================= LOCATION ================= */}
            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <span className="text-lg">📍</span>
                Property Location
              </label>

              <input
                list="bengaluru-locations"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Search or enter a Bengaluru location..."
                required
                autoComplete="off"
                className="w-full rounded-2xl border border-cyan-400/20 bg-slate-900/70 px-6 py-5 text-lg text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />

              <datalist id="bengaluru-locations">
                {locations.map((location, index) => (
                  <option key={`${location}-${index}`} value={location} />
                ))}
              </datalist>

              <p className="mt-2 text-xs text-slate-500">
                Select a location from the suggestions or enter the exact
                location name used by the dataset.
              </p>
            </div>

            {/* ================= PREDICT BUTTON ================= */}
            <div className="md:col-span-2 pt-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 px-6 py-5 text-lg font-bold text-white shadow-xl shadow-cyan-500/20 transition hover:shadow-purple-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Analyzing Property...
                  </span>
                ) : (
                  "Predict Property Price →"
                )}
              </motion.button>
            </div>
          </form>

          {/* ================= RESULT ================= */}
          {prediction !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-10 overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-slate-950 p-8 text-center shadow-2xl shadow-cyan-500/10"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                Estimated Property Price
              </p>

              <motion.p
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15 }}
                className="mt-3 text-5xl font-black text-cyan-300 md:text-7xl"
              >
                ₹ {Number(prediction).toFixed(2)} Lakhs
              </motion.p>

              <p className="mt-4 text-slate-400">
                AI-generated estimate based on your property details
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">
                  📍 {formData.location}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  🏠 {formData.bhk} BHK
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  📐 {formData.total_sqft} sq.ft
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

export default PredictionForm;