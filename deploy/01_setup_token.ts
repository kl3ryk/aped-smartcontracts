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
  cyan("                Setup APED Token");
  cyan("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

  dim(`network: ${chainName(chainId)} (${isTestEnvironment ? "local" : "remote"})`);
  dim(`deployer: ${deployer}`);

  dim("\nExtracting APED Contract...");

  const beneficiary = "";
  const buyTax = 200;
  const sellTax = 200;
  const dexPair = "0xc0A0EB675259a64ADE8F3dbeD50818bd2CfEe720"; // WETH/APED Base

  const apedDeployment = await get("APED");
  const apedContract = await ethers.getContractAt("APED", apedDeployment.address, signer);

  let transaction;

  cyan("\nAdd beneficiary...");

  transaction = await apedContract.updateBeneficiary(beneficiary);
  await transaction.wait(2);

  cyan("\nUpdate buy tax..");

  transaction = await apedContract.updateBuyTax(buyTax);
  await transaction.wait(2);

  cyan("\nUpdate buy tax..");

  transaction = await apedContract.updateSellTax(sellTax);
  await transaction.wait(2);

  cyan("\nAdd dex pair...");

  transaction = await apedContract.updateTaxableDex(dexPair, true);
  await transaction.wait(2);

  green(`Done!`);
};

export default func;
func.tags = ["Setup"];
