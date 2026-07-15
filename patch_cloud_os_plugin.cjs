const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/export default function CloudOS\(\) \{/,
`interface CloudOSProps {
  initialPluginSearch?: string;
}

export default function CloudOS({ initialPluginSearch }: CloudOSProps) {`
);

code = code.replace(
/  const \[pluginSearch, setPluginSearch\] = useState\(''\);/,
`  const [pluginSearch, setPluginSearch] = useState(initialPluginSearch || '');`
);

code = code.replace(
/  useEffect\(\(\) => \{\n    if \(searchQuery\.trim\(\) === ''\)/,
`  useEffect(() => {
    if (initialPluginSearch) {
      setShowPlugins(true);
      setPluginSearch(initialPluginSearch);
    }
  }, [initialPluginSearch]);

  useEffect(() => {
    if (searchQuery.trim() === '')`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
