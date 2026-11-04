// Configuração dinâmica: o caminho base da versão web (GitHub Pages) vem da variável EXPO_BASE_URL.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || "" },
});
