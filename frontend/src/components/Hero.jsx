import { motion } from "framer-motion";

function Hero() {
  const scrollToPrediction = () => {
    const element = document.getElementById("prediction");

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const scrollToDashboard = () => {
    const element = document.getElementById("dashboard");

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-slate-950 px-6 py-24 text-white md:py-32"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-20 -z-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/5 px-6 py-3"
        >
          <span className="text-sm font-semibold text-cyan-300 md:text-base">
            ✨ AI-Powered Real Estate Intelligence
          </span>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <h2 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight text-white md:text-7xl lg:text-8xl">

            <span className="block text-white">
              Predict the
            </span>

            <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Future of Property
            </span>

            <span className="block text-white">
              Prices.
            </span>

          </h2>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 max-w-4xl text-lg leading-8 text-slate-400 md:text-xl"
        >
          Smart Real Estate Analytics uses machine learning to estimate
          Bengaluru property prices and help you make better investment
          decisions.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >

          <motion.button
            type="button"
            onClick={scrollToPrediction}
            whileHover={{
              scale: 1.04,
              boxShadow: "0 0 40px rgba(34, 211, 238, 0.30)",
            }}
            whileTap={{ scale: 0.97 }}
            className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-8 py-5 text-lg font-bold text-white shadow-xl shadow-cyan-500/20"
          >
            Start Prediction →
          </motion.button>

          <motion.button
            type="button"
            onClick={scrollToDashboard}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-2xl border border-white/10 bg-white/5 px-8 py-5 text-lg font-bold text-white backdrop-blur-xl transition hover:bg-white/10"
          >
            Explore Analytics
          </motion.button>

        </motion.div>

        {/* Stats */}
        <div className="mt-20 grid gap-5 md:grid-cols-3">

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
            <p className="text-4xl font-black text-cyan-300">13K+</p>
            <p className="mt-2 text-slate-400">Properties Analyzed</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
            <p className="text-4xl font-black text-blue-400">79%</p>
            <p className="mt-2 text-slate-400">R² Model Accuracy</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
            <p className="text-4xl font-black text-purple-400">AI</p>
            <p className="mt-2 text-slate-400">Price Prediction</p>
          </div>

        </div>
      </div>
    </section>
  );
}

export default Hero;