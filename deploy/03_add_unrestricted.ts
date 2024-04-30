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

  const account = "0x09350F89e2D7B6e96bA730783c2d76137B045FEF"; // drop gaslite Base
  const unrestricted = true;

  const apedDeployment = await get("APED");
  const apedContract = await ethers.getContractAt("APED", apedDeployment.address, signer);

  cyan("\n Update Unrestricted Account...");

  const transaction = await apedContract.updateUnrestrictedAccount(account, unrestricted);
  await transaction.wait(2);

  green(`Done!`);
};

export default func;
func.tags = ["Unrestricted"];
