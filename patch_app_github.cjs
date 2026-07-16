const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
`;
const replacement = target + `
      if (session?.provider_token) {
         localStorage.setItem('github_token', session.provider_token);
      }
`;
code = code.replace(target, replacement);

const target2 = `    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);`;
const replacement2 = target2 + `
      if (session?.provider_token) {
         localStorage.setItem('github_token', session.provider_token);
      }`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', code);
