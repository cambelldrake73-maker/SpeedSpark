/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  const isSimulatorBuild = profile.includes('simulator');

  const plugins = (config.plugins ?? []).filter((plugin) => {
    if (!isSimulatorBuild) {
      return true;
    }
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'expo-notifications';
  });

  return {
    ...config,
    plugins,
  };
};
