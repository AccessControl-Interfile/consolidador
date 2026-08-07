const fs = require('fs');
let code = fs.readFileSync('src/components/SupabaseModal.tsx', 'utf-8');

const regex = /\/\/ Test connection & auto-discover public tables via OpenAPI Swagger endpoint[\s\S]*?setTables\(discoveredTables\);\n\n      \/\/ Save valid credentials to Firebase[\s\S]*?saveSupabaseConfigToFirebase.*?;\n\s*\} catch \(err: any\) \{\n.*?console\.error.*?\n.*?setConnectionError.*?\n\s*\} finally \{\n\s*setIsTesting\(false\);\n\s*setIsLoadingTables\(false\);\n\s*\}\n\s*\};\n/m;

const replacement = `// Test connection & auto-discover public tables via OpenAPI Swagger endpoint
  const testAndFetchSchema = async () => {
    setIsLoadingTables(true);
    setConnectionError(null);
    const cleanUrl = import.meta.env.VITE_SUPABASE_URL;
    const cleanKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!cleanUrl || !cleanKey) {
      setConnectionError('Configuração de URL/Key do Supabase ausente no .env');
      setIsLoadingTables(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || cleanKey;
      const openApiRes = await fetch(\`\${cleanUrl}/rest/v1/?apikey=\${cleanKey}\`, {
        headers: {
          'apikey': cleanKey,
          'Authorization': \`Bearer \${token}\`,
          'Accept': 'application/json, application/openapi+json'
        }
      });
      let discoveredTables: SupabaseTable[] = [];
      if (openApiRes.ok) {
        const swagger = await openApiRes.json();
        const schemas = swagger?.components?.schemas || swagger?.definitions || {};
        Object.keys(schemas).forEach(tableName => {
          if (tableName.startsWith('rpc/') || tableName.startsWith('_')) return;
          const def = schemas[tableName];
          const cols: { name: string; type?: string }[] = [];
          if (def && def.properties) {
            Object.keys(def.properties).forEach(propName => {
              cols.push({ name: propName, type: def.properties[propName].type || 'string' });
            });
          }
          discoveredTables.push({ name: tableName, columns: cols });
        });
        if (swagger && swagger.paths) {
          Object.keys(swagger.paths).forEach(pathKey => {
            if (pathKey.startsWith('/') && pathKey !== '/' && !pathKey.startsWith('/rpc/')) {
              const rawName = pathKey.replace(/^\\//, '').split('?')[0];
              if (rawName && !rawName.startsWith('_') && !discoveredTables.some(t => t.name === rawName)) {
                discoveredTables.push({ name: rawName, columns: [] });
              }
            }
          });
        }
      }
      setTables(discoveredTables);
    } catch (err: any) {
      setConnectionError(err.message || 'Falha ao buscar tabelas do Supabase.');
    } finally {
      setIsLoadingTables(false);
    }
  };
`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/SupabaseModal.tsx', code);
