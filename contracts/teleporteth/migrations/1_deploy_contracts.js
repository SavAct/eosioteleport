const TeleportToken = artifacts.require("TeleportToken");

module.exports = function(deployer) {
  deployer.deploy(TeleportToken);
};
