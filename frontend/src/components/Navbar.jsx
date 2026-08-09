import { motion } from "framer-motion";

function Navbar() {
  const scrollToSection = (id) => {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

        {/* Logo */}
        <button
          onClick={() => scrollToSection("home")}
          className="flex items-center gap-4 text-left"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-4xl shadow-lg shadow-cyan-500/20">
            🏠
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              RealEstateAI
            </h1>

            <p className="mt-1 text-sm text-slate-400 md:text-base">
              AI Powered Investment Platform
            </p>
          </div>
        </button>

        {/* Dashboard Button */}
        <motion.button
          type="button"
          onClick={() => scrollToSection("dashboard")}
          whileHover={{
            scale: 1.04,
            boxShadow: "0 0 35px rgba(34, 211, 238, 0.30)",
          }}
          whileTap={{ scale: 0.97 }}
          className="rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-cyan-500/20 md:px-9 md:py-5 md:text-xl"
        >
          Dashboard →
        </motion.button>
      </div>
    </nav>
  );
}

export default Navbar;