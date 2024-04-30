import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { chainName, dim, cyan, green } from "./utilities/utils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, getChainId, ethers } = hre;
  const { get } = deployments;
  const { deployer } = await getNamedAccounts();
  const signer = ethers.provider.getSigner(deployer);

  const chainId = parseInt(await getChainId());

  // 31337 is unit testing, 1337 is for coverage
  const isTestEnvironment = chainId === 31337 || chainId === 1337;

  cyan("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  cyan("         Update APED Restriction Time");
  cyan("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} (${isTestEnvironment ? "local" : "remote"})`);
  dim(`deployer: ${deployer}`);

  dim("\nExtracting APED Contract...");

  const timestamp = 1714737600; // Fri May 03 2024 12:00:00 GMT+0000

  const apedDeployment = await get("APED");
  const apedContract = await ethers.getContractAt("APED", apedDeployment.address, signer);

  cyan("\n Update Restricted Transfers End Time...");

  const transaction = await apedContract.updateRestrictedTransfersEndTime(timestamp);
  await transaction.wait(2);

  green(`Done!`);
};

export default func;
func.tags = ["Update"];
