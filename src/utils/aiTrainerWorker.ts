type Stats = {
  datapoints: number;
  parameters: number;
  latency: number;
};

let currentStats: Stats = {
  datapoints: 142893110,
  parameters: 4281,
  latency: 0.8
};

type Listener = (stats: Stats) => void;
const listeners: Set<Listener> = new Set();

export const aiTrainerStore = {
  getStats: () => currentStats,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

const notifyListeners = () => {
  listeners.forEach(listener => listener(currentStats));
};

let workerStarted = false;

export const startAiTrainerWorker = () => {
  if (workerStarted) return;
  workerStarted = true;

  const fetchExternalData = async () => {
    try {
      const response = await fetch('/api/training-stats');
      if (!response.ok) return;
      
      const data = await response.json();
      
      currentStats = {
        datapoints: data.datapoints || currentStats.datapoints,
        parameters: data.parameters || currentStats.parameters,
        latency: Number((data.latency || currentStats.latency).toFixed(1))
      };
      
      notifyListeners();
    } catch (err) {
      console.error("AI Trainer Worker Error:", err);
    }
  };

  fetchExternalData();
  setInterval(fetchExternalData, 3000);
};
