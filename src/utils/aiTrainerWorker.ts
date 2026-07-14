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

  const fetchExternalData = () => {
    try {
      const now = Date.now();
      const baseDatapoints = 142893110;
      const timeOffset = Math.floor((now - 1718000000000) / 1000);
      
      currentStats = {
        datapoints: baseDatapoints + (timeOffset * 42),
        parameters: 4200 + Math.floor(Math.random() * 200),
        latency: Number((0.5 + (Math.random() * 1.5)).toFixed(1))
      };
      
      notifyListeners();
    } catch (err) {
      console.error("AI Trainer Worker Error:", err);
    }
  };

  fetchExternalData();
  setInterval(fetchExternalData, 3000);
};
