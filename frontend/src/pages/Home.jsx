import { useState } from "react";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import PredictionForm from "../components/PredictionForm";
import Dashboard from "../components/Dashboard";

function Home() {

  const [propertyData, setPropertyData] = useState(null);

  return (

    <div className="min-h-screen bg-slate-950 text-white">

      <Navbar />

      <main>

        <Hero />

        <PredictionForm
          onPrediction={(data) => {

            setPropertyData(data);

          }}
        />

        <Dashboard
          propertyData={propertyData}
        />

      </main>

    </div>
  );
}

export default Home;