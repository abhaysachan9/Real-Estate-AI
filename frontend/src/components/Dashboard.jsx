import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:5001";

function Dashboard({ propertyData }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!propertyData) {
      setAnalytics(null);
      return;
    }

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/analytics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(propertyData),
        });

        const data = await response.json();

        if (!response.ok || data.status !== "success") {
          throw new Error(
            data.message || `Analytics request failed (${response.status})`
          );
        }

        setAnalytics(data);
      } catch (err) {
        console.error("Dashboard analytics error:", err);
        setError(
          "Unable to load analytics. Make sure the Flask backend is running on port 5001."
        );
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [propertyData]);

  const predictedPrice = Number(
    analytics?.property?.predicted_price ??
      analytics?.predicted_price ??
      propertyData?.predicted_price ??
      0
  );

  const predictedPps = Number(
    analytics?.property?.predicted_price_per_sqft ??
      analytics?.predicted_price_per_sqft ??
      (propertyData?.total_sqft
        ? (predictedPrice * 100000) / Number(propertyData.total_sqft)
        : 0)
  );

  const locationBenchmark = analytics?.location_benchmark || {};
  const comparableSummary = analytics?.comparables_summary || {};

  // Compare the prediction with a size-adjusted locality benchmark.
  // This avoids comparing total prices of properties with different areas.
  const benchmarkPrice = Number(
    analytics?.benchmark?.price ??
      analytics?.benchmark?.size_adjusted_price ??
      0
  );
  const comparableAverage = Number(
    comparableSummary.average_price || 0
  );

  const difference = Number(
    analytics?.market_difference_percent || 0
  );

  const comparisonBars = useMemo(() => {
    const values = [
      {
        label: "AI Prediction",
        value: predictedPrice,
        type: "cyan",
      },
      {
        label: "Size-Adjusted Locality Benchmark",
        value: benchmarkPrice,
        type: "purple",
      },
      {
        label: "Comparable Average",
        value: comparableAverage,
        type: "emerald",
      },
    ].filter((item) => item.value > 0);

    const max = Math.max(...values.map((item) => item.value), 1);

    return values.map((item) => ({
      ...item,
      percentage: Math.min((item.value / max) * 100, 100),
    }));
  }, [predictedPrice, benchmarkPrice, comparableAverage]);

  const locationComparison = Array.isArray(
    analytics?.location_benchmark?.comparison
  )
    ? analytics.location_benchmark.comparison
    : Array.isArray(analytics?.charts?.location_comparison)
      ? analytics.charts.location_comparison
      : Array.isArray(analytics?.location_comparison)
        ? analytics.location_comparison
        : [];

  const areaPrice = Array.isArray(analytics?.charts?.area_price)
    ? analytics.charts.area_price
    : [];

  const comparables = Array.isArray(analytics?.comparables)
    ? analytics.comparables
    : [];

  const bhkComparison = Array.isArray(analytics?.charts?.bhk_comparison)
    ? analytics.charts.bhk_comparison
    : [];

  const maxLocationPps = Number(
    analytics?.max_location_pps ||
      Math.max(
        ...locationComparison.map((x) => Number(x.price_per_sqft || 0)),
        1
      )
  );

  const historicalRange = analytics?.historical_price_range || {};
  const lowerRange = Number(historicalRange.lower || 0);
  const upperRange = Number(historicalRange.upper || 0);

  const decisionText =
    difference <= -10
      ? "BELOW HISTORICAL BENCHMARK"
      : difference >= 10
        ? "ABOVE HISTORICAL BENCHMARK"
        : "CLOSE TO HISTORICAL BENCHMARK";

  const propertyQuality = analytics?.property_quality || {};
  const comparableStrength =
    analytics?.data_quality?.comparable_strength ||
    (comparables.length >= 5
      ? "STRONG"
      : comparables.length >= 3
        ? "MODERATE"
        : comparables.length > 0
          ? "LIMITED"
          : "NONE");

  return (
    <section
      id="dashboard"
      className="scroll-mt-24 bg-slate-950 px-6 py-24 text-white md:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-400">
            REAL ESTATE INTELLIGENCE
          </p>

          <h2 className="mt-3 text-4xl font-black md:text-6xl">
            Property{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Analytics
            </span>
          </h2>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
            A data-driven analysis of the selected property using the
            historical Bengaluru house-price dataset.
          </p>
        </motion.div>

        {!propertyData && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <div className="text-6xl">🏠</div>
            <h3 className="mt-5 text-2xl font-bold">
              Your property analytics will appear here
            </h3>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-400">
              Enter property details and generate a prediction first.
            </p>
          </div>
        )}

        {propertyData && error && (
          <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-8">
            <p className="text-lg font-bold text-red-300">
              Analytics could not be loaded
            </p>
            <p className="mt-2 text-slate-400">{error}</p>
          </div>
        )}

        {propertyData && loading && (
          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-12 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
            <p className="mt-5 font-semibold text-cyan-300">
              Building your property analytics...
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Comparing the prediction with historical Bengaluru data.
            </p>
          </div>
        )}

        {propertyData && analytics && !loading && !error && (
          <div className="space-y-6">
            {/* SUMMARY */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-purple-500/10 p-8 shadow-2xl"
            >
              <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-400">
                    ANALYZED PROPERTY
                  </p>

                  <h3 className="mt-2 text-3xl font-black md:text-4xl">
                    {propertyData.location || "Bengaluru"}
                  </h3>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Tag text={`${propertyData.bhk || "-"} BHK`} />
                    <Tag text={`${propertyData.total_sqft || "-"} sq.ft`} />
                    <Tag text={`${propertyData.bath || "-"} Bathrooms`} />
                    <Tag text={`${propertyData.balcony ?? "-"} Balconies`} />
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/60 px-7 py-5 lg:min-w-[330px] lg:text-right">
                  <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                    ML ESTIMATED VALUE
                  </p>

                  <p className="mt-2 text-5xl font-black text-cyan-300">
                    ₹{predictedPrice.toFixed(2)} Lakhs
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    ₹{Math.round(predictedPps).toLocaleString("en-IN")}/sq.ft
                  </p>

                  <p className="mt-2 text-xs text-slate-600">
                    Historical-dataset model estimate
                  </p>
                </div>
              </div>
            </motion.div>

            {/* KPI */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <KPI
                title="AI Estimate"
                value={`₹${predictedPrice.toFixed(2)}L`}
                subtitle="Model-estimated property value"
                color="cyan"
              />

              <KPI
                title="AI ₹/Sq.Ft."
                value={`₹${Math.round(predictedPps).toLocaleString("en-IN")}`}
                subtitle="Predicted unit price"
                color="blue"
              />

              <KPI
                title="Size-Adjusted Benchmark"
                value={
                  benchmarkPrice
                    ? `₹${benchmarkPrice.toFixed(2)}L`
                    : "N/A"
                }
                subtitle={`Locality median ₹/sq.ft scaled to ${propertyData.total_sqft || 0} sq.ft`}
                color="purple"
              />

              <KPI
                title="Comparable Homes"
                value={analytics.comparable_count ?? comparables.length}
                subtitle="Historical similar records"
                color="emerald"
              />
            </div>

            {/* COMPARISON + POSITION */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel>
                <SectionHeading
                  title="Price Comparison"
                  subtitle="Model estimate versus size-adjusted historical references"
                />

                <div className="mt-10 space-y-7">
                  {comparisonBars.map((item) => (
                    <ComparisonBar key={item.label} item={item} />
                  ))}
                </div>

                <div className="mt-8 rounded-2xl border border-yellow-400/10 bg-yellow-400/5 p-4">
                  <p className="text-xs leading-6 text-slate-400">
                    These are historical dataset references, not live
                    Bengaluru property quotations.
                  </p>
                </div>
              </Panel>

              <Panel>
                <SectionHeading
                  title="Market Position"
                  subtitle="Prediction compared with the size-adjusted locality benchmark"
                />

                <div className="mt-8 rounded-2xl border border-cyan-400/10 bg-slate-900/70 p-6">
                  <p className="text-sm text-slate-500">
                    Difference from size-adjusted locality benchmark
                  </p>

                  <p
                    className={`mt-3 text-5xl font-black ${
                      difference <= 0
                        ? "text-emerald-400"
                        : "text-orange-400"
                    }`}
                  >
                    {difference > 0 ? "+" : ""}
                    {difference.toFixed(1)}%
                  </p>

                  <span className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                    {decisionText}
                  </span>

                  <p className="mt-4 leading-7 text-slate-400">
                    {analytics.recommendation_reason}
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-yellow-400/10 bg-yellow-400/5 p-5">
                  <p className="font-semibold text-yellow-300">
                    ⚠ Historical-data disclaimer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    A lower or higher model value does not prove a property is
                    undervalued or overpriced today. Current listings,
                    property condition and transaction prices can differ.
                  </p>
                </div>
              </Panel>
            </div>

            {/* HISTORICAL RANGE */}
            {(lowerRange > 0 || upperRange > 0) && (
              <Panel>
                <SectionHeading
                  title="Historical Comparable Range"
                  subtitle="Middle 50% of the available comparable/locality historical prices"
                />

                <div className="mt-8 grid gap-5 md:grid-cols-3">
                  <RangeCard
                    title="Lower reference"
                    value={lowerRange}
                  />
                  <RangeCard
                    title="AI estimate"
                    value={predictedPrice}
                    highlight
                  />
                  <RangeCard
                    title="Upper reference"
                    value={upperRange}
                  />
                </div>

                <p className="mt-5 text-xs leading-6 text-slate-500">
                  This is a historical data range, not a statistical model
                  confidence interval.
                </p>
              </Panel>
            )}

            {/* AREA VS PRICE */}
            <Panel>
              <SectionHeading
                title="Area vs Property Price"
                subtitle="Historical properties used as context for this prediction"
              />

              <div className="mt-8">
                <AreaPriceChart
                  points={areaPrice}
                  prediction={{
                    area: Number(propertyData.total_sqft || 0),
                    price: predictedPrice,
                  }}
                />
              </div>
            </Panel>

            {/* LOCATION BENCHMARK */}
            <Panel>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <SectionHeading
                  title="Location Price Benchmark"
                  subtitle="Historical median price per square foot across selected Bengaluru locations"
                />

                <span className="w-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold tracking-widest text-cyan-300">
                  DATASET BENCHMARK
                </span>
              </div>

              {locationComparison.length > 0 ? (
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  {locationComparison.map((item, index) => (
                    <LocationBar
                      key={`${item.location}-${index}`}
                      item={item}
                      max={maxLocationPps}
                      selected={
                        item.location?.toLowerCase() ===
                        propertyData.location?.toLowerCase()
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyMini text="Location comparison data is not available." />
              )}
            </Panel>

            {/* BHK BENCHMARK */}
            {bhkComparison.length > 0 && (
              <Panel>
                <SectionHeading
                  title="BHK Price Benchmark"
                  subtitle="Historical median property prices by bedroom configuration"
                />

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {bhkComparison.map((item) => (
                    <div
                      key={item.bhk}
                      className={`rounded-2xl border p-5 ${
                        Number(item.bhk) === Number(propertyData.bhk)
                          ? "border-cyan-400/40 bg-cyan-400/5"
                          : "border-white/10 bg-slate-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-white">
                          {item.bhk} BHK
                        </p>
                        {Number(item.bhk) === Number(propertyData.bhk) && (
                          <span className="text-xs font-bold text-cyan-400">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <p className="mt-4 text-2xl font-black text-purple-300">
                        ₹{Number(item.median_price || 0).toFixed(2)}L
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Median · {item.sample_count} records
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* PROPERTY INSIGHTS */}
            <div className="grid gap-6 md:grid-cols-3">
              <InsightCard
                icon="📍"
                title="Location"
                value={propertyData.location || "N/A"}
                text="Locality is used as a major categorical feature by the prediction model."
              />

              <InsightCard
                icon="📐"
                title="Property Size"
                value={`${propertyData.total_sqft || "N/A"} sq.ft`}
                text="Area is one of the core numerical features used by the model."
              />

              <InsightCard
                icon="🏠"
                title="Configuration"
                value={`${propertyData.bhk || "-"} BHK`}
                text="BHK, bathrooms and balconies contribute to the property representation."
              />
            </div>

            {/* COMPARABLES */}
            <Panel>
              <SectionHeading
                title="Comparable Properties"
                subtitle="Historical records ranked by transparent feature similarity"
              />

              {comparables.length > 0 ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {comparables.map((item, index) => (
                    <motion.div
                      key={`${item.location}-${item.total_sqft}-${index}`}
                      whileHover={{ y: -5 }}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 transition hover:border-cyan-400/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-cyan-300">
                          {item.location || "Bengaluru"}
                        </p>

                        <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-xs font-bold text-cyan-300">
                          {item.similarity_score ?? "-"}% match
                        </span>
                      </div>

                      <p className="mt-4 text-2xl font-black text-white">
                        ₹{Number(item.price || 0).toFixed(2)}L
                      </p>

                      <div className="mt-4 space-y-2 text-sm text-slate-500">
                        <p>🏠 {item.bhk ?? "-"} BHK</p>
                        <p>
                          📐{" "}
                          {Math.round(Number(item.total_sqft || 0))} sq.ft
                        </p>
                        <p>🛁 {item.bath ?? "-"} bathrooms</p>
                        <p>
                          ₹
                          {Math.round(
                            Number(item.price_per_sqft || 0)
                          ).toLocaleString("en-IN")}
                          /sq.ft
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyMini text="No comparable historical records were returned." />
              )}
            </Panel>

            {/* DATA QUALITY + CONFIGURATION CHECK */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel>
                <SectionHeading
                  title="Comparable Evidence"
                  subtitle="How much historical evidence supports this comparison"
                />
                <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                  <div>
                    <p className="text-sm text-slate-500">Comparable records</p>
                    <p className="mt-2 text-3xl font-black text-emerald-400">
                      {analytics.comparable_count ?? comparables.length}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                    {comparableStrength} EVIDENCE
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {comparableStrength === "LIMITED"
                    ? "Only a small number of similar historical records were found, so this comparison should be treated cautiously."
                    : comparableStrength === "NONE"
                      ? "No sufficiently similar historical records were found."
                      : "Comparable records provide supporting historical context for the estimate."}
                </p>
              </Panel>

              <Panel>
                <SectionHeading
                  title="Configuration Check"
                  subtitle="Detects unusual property sizes before interpreting the prediction"
                />
                <div className={`mt-6 rounded-2xl border p-5 ${
                  propertyQuality.configuration_flag
                    ? "border-orange-400/20 bg-orange-400/5"
                    : "border-emerald-400/20 bg-emerald-400/5"
                }`}>
                  <p className={`font-bold ${propertyQuality.configuration_flag ? "text-orange-300" : "text-emerald-300"}`}>
                    {propertyQuality.configuration_flag ? "⚠ Unusual configuration" : "✓ Within historical range"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {propertyQuality.message || "Configuration check completed."}
                  </p>
                </div>
              </Panel>
            </div>

            {/* DECISION SUPPORT */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-cyan-400/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 p-8"
            >
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-500">
                AI DECISION SUPPORT
              </p>

              <div className="mt-5 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
                <div>
                  <h3 className="text-3xl font-black">
                    {decisionText}
                  </h3>

                  <p className="mt-3 max-w-3xl leading-7 text-slate-400">
                    {analytics.recommendation_reason}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-8 py-5 text-center">
                  <p className="text-xs uppercase tracking-widest text-slate-500">
                    MODEL CONTEXT
                  </p>

                  <p className="mt-2 text-xl font-black text-cyan-300">
                    R² ≈ {Number(
                      analytics?.model_context?.r2 ?? 0
                    ).toFixed(3)}
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Project model metric · not confidence
                  </p>
                </div>
              </div>
            </motion.div>

            {/* FINAL TRANSPARENCY */}
            <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/5 p-6">
              <p className="font-bold text-yellow-300">
                ⚠ How to interpret this prediction
              </p>

              <p className="mt-2 text-sm leading-7 text-slate-400">
                This application provides an ML-based estimate using the
                project's Bengaluru historical dataset. The predicted value
                is not a guaranteed current market price, property quotation,
                or transaction value. Actual prices can vary with exact
                location, building age, floor, amenities, furnishing,
                condition, developer and current demand.
              </p>

              <p className="mt-3 text-xs text-slate-500">
                Data source: {analytics?.data_source?.file || "Bengaluru_House_Data.csv"}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   UI COMPONENTS
   ============================================================ */

function Panel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-8"
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div>
      <h3 className="text-xl font-bold text-white md:text-2xl">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function Tag({ text }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300">
      {text}
    </span>
  );
}

function KPI({ title, value, subtitle, color }) {
  const colors = {
    cyan: "text-cyan-300",
    blue: "text-blue-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
    >
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className={`mt-3 text-3xl font-black ${colors[color]}`}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {subtitle}
      </p>
    </motion.div>
  );
}

function ComparisonBar({ item }) {
  const barColors = {
    cyan: "from-cyan-400 to-blue-500",
    purple: "from-purple-500 to-pink-500",
    emerald: "from-emerald-400 to-teal-500",
  };

  return (
    <div>
      <div className="mb-2 flex justify-between gap-4 text-sm">
        <span className="font-medium text-slate-400">
          {item.label}
        </span>
        <span className="font-bold text-white">
          ₹{Number(item.value).toFixed(2)}L
        </span>
      </div>

      <div className="h-4 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${item.percentage}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${barColors[item.type]}`}
        />
      </div>
    </div>
  );
}

function LocationBar({ item, max, selected }) {
  const value = Number(item.price_per_sqft || 0);
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div
      className={`rounded-2xl border p-5 ${
        selected
          ? "border-cyan-400/40 bg-cyan-400/5"
          : "border-white/10 bg-slate-900/50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-white">
            {item.location}
          </p>

          {selected && (
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Selected locality
            </span>
          )}
        </div>

        <p className="font-black text-cyan-300">
          ₹{Math.round(value).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
        />
      </div>

      <p className="mt-2 text-right text-xs text-slate-600">
        median per sq.ft · {item.sample_count ?? 0} records
      </p>
    </div>
  );
}

function AreaPriceChart({ points, prediction }) {
  if (!points.length) {
    return (
      <EmptyMini text="Not enough historical records are available for this chart." />
    );
  }

  const width = 1000;
  const height = 420;
  const padX = 70;
  const padY = 35;

  const areas = points.map((p) => Number(p.area || 0));
  const prices = points.map((p) => Number(p.price || 0));

  const maxArea = Math.max(...areas, prediction.area || 1);
  const maxPrice = Math.max(...prices, prediction.price || 1);

  const minArea = Math.min(...areas, prediction.area || 0);
  const minPrice = Math.min(...prices, 0);

  const xScale = (value) =>
    padX +
    ((value - minArea) /
      Math.max(maxArea - minArea, 1)) *
      (width - padX * 2);

  const yScale = (value) =>
    height -
    padY -
    ((value - minPrice) /
      Math.max(maxPrice - minPrice, 1)) *
      (height - padY * 2);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[760px] w-full"
          role="img"
          aria-label="Area versus property price historical scatter plot"
        >
          {[0.2, 0.4, 0.6, 0.8].map((fraction) => {
            const y = padY + fraction * (height - padY * 2);
            return (
              <line
                key={fraction}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="1"
              />
            );
          })}

          <line
            x1={padX}
            x2={width - padX}
            y1={height - padY}
            y2={height - padY}
            stroke="rgba(148,163,184,0.25)"
          />

          <line
            x1={padX}
            x2={padX}
            y1={padY}
            y2={height - padY}
            stroke="rgba(148,163,184,0.25)"
          />

          {points.map((point, index) => (
            <circle
              key={`${point.area}-${point.price}-${index}`}
              cx={xScale(Number(point.area))}
              cy={yScale(Number(point.price))}
              r="6"
              fill="#22d3ee"
              opacity="0.85"
            >
              <title>
                {Math.round(Number(point.area)).toLocaleString("en-IN")} sq.ft · ₹
                {Number(point.price).toFixed(2)}L
              </title>
            </circle>
          ))}

          <circle
            cx={xScale(prediction.area)}
            cy={yScale(prediction.price)}
            r="11"
            fill="#a855f7"
            stroke="#f5d0fe"
            strokeWidth="3"
          >
            <title>
              AI prediction · {Math.round(prediction.area).toLocaleString("en-IN")} sq.ft · ₹
              {prediction.price.toFixed(2)}L
            </title>
          </circle>
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-400">
        <span>
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-cyan-400" />
          Historical properties
        </span>
        <span>
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-purple-500" />
          Your AI prediction
        </span>
      </div>

      <div className="mt-3 flex justify-between text-xs text-slate-600">
        <span>Property area</span>
        <span>Price in lakhs</span>
      </div>
    </div>
  );
}

function RangeCard({ title, value, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        highlight
          ? "border-cyan-400/30 bg-cyan-400/5"
          : "border-white/10 bg-slate-900/50"
      }`}
    >
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p
        className={`mt-3 text-3xl font-black ${
          highlight ? "text-cyan-300" : "text-white"
        }`}
      >
        ₹{Number(value).toFixed(2)}L
      </p>
    </div>
  );
}

function InsightCard({ icon, title, value, text }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          {title}
        </p>
      </div>

      <p className="mt-4 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function EmptyMini({ text }) {
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export default Dashboard;
