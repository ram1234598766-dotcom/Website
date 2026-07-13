sed -i 's/142,893,110/{stats.datapoints.toLocaleString()}/g' src/components/CloudInfrastructure.tsx
sed -i 's/+4,281\/sec/+{stats.parameters}\/sec/g' src/components/CloudInfrastructure.tsx
sed -i 's/0.8ms Latency/{stats.latency.toFixed(1)}ms Latency/g' src/components/CloudInfrastructure.tsx
