import { waffle } from "hardhat";
import { expect } from "chai";
import { Wallet, BigNumber } from "ethers";

import APEDTokenArtifacts from "../artifacts/contracts/APED.sol/APED.json";
import { APED } from "../typechain";
import { getBigNumber, latest, duration, advanceTimeAndBlock, ADDRESS_ZERO } from "./utilities";

const { provider, deployContract } = waffle;

// Error codes
const Error_Forbidden: string = "Forbidden";
const Error_ZeroAddress: string = "ZeroAddress";
const Error_Overtaxed: string = "Overtaxed";
const Error_OwnableUnauthorizedAccount: string = "OwnableUnauthorizedAccount";

// Event names
const Event_Transfer: string = "Transfer";
const Event_UpdatedBuyTax: string = "UpdatedBuyTax";
const Event_UpdatedSellTax: string = "UpdatedSellTax";
const Event_UpdatedBeneficiary: string = "UpdatedBeneficiary";
const Event_UpdatedTaxableTransfers: string = "UpdatedTaxableTransfers";
const Event_UpdatedTaxableDex: string = "UpdatedTaxableDex";
const Event_UpdatedUntaxableAccount: string = "UpdatedUntaxableAccount";
const Event_UpdatedUnrestrictedAccount: string = "UpdatedUnrestrictedAccount";
const Event_UpdatedRestrictedTransfersEndTime: string = "UpdatedRestrictedTransfersEndTime";

describe("APED ERC20", () => {
  const [deployer, alice, bob, beneficiary, unitRouterV2, uniPairV2] = provider.getWallets() as Wallet[];

  let apedToken: APED;
  let now;

  const ONE_HUNDRED_MILLION_TOKENS: BigNumber = getBigNumber(100_000_000);

  async function makeSUT() {
    return (await deployContract(deployer, APEDTokenArtifacts, [])) as APED;
  }

  beforeEach(async () => {
    apedToken = await makeSUT();
    now = await latest();
  });

  describe("constructor", () => {
    it("should initialize as expected", async function () {
      expect(await apedToken.name()).to.be.equal("APED");
      expect(await apedToken.symbol()).to.be.equal("APED");
      expect(await apedToken.decimals()).to.be.equal(18);
      expect(await apedToken.totalSupply()).to.be.equal(ONE_HUNDRED_MILLION_TOKENS);
      expect(await apedToken.taxableTransfers()).to.be.equal(true);
      expect(await apedToken.untaxableAccount(deployer.address)).to.be.equal(true);
      expect(await apedToken.unrestrictedAccount(deployer.address)).to.be.equal(true);
      expect(await apedToken.restrictedTransfersEndTime()).to.be.equal(now.add(duration.days(7)));
    });
  });

  describe("restrictedTransfersEndTime", () => {
    beforeEach(async () => {
      await apedToken.transfer(alice.address, getBigNumber(1000));
    });

    describe("before the end of the restriction time", () => {
      it("should revert when user try to transfer", async function () {
        await expect(apedToken.connect(alice).transfer(bob.address, getBigNumber(100))).to.be.revertedWith(
          Error_Forbidden
        );
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
      });

      it("should revert when user try to transferFrom", async function () {
        await apedToken.connect(alice).approve(bob.address, getBigNumber(100));
        await expect(
          apedToken.connect(bob).transferFrom(alice.address, bob.address, getBigNumber(100))
        ).to.be.revertedWith(Error_Forbidden);
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
      });

      it("should transferFrom correctly if transferred from unrestricted address", async function () {
        await apedToken.approve(unitRouterV2.address, getBigNumber(100));
        await expect(
          apedToken.connect(unitRouterV2).transferFrom(deployer.address, uniPairV2.address, getBigNumber(100))
        )
          .to.emit(apedToken, Event_Transfer)
          .withArgs(deployer.address, uniPairV2.address, getBigNumber(100));
        expect(await apedToken.balanceOf(uniPairV2.address)).to.be.equal(getBigNumber(100));
      });

      it("should transfer correctly if transferred by unrestricted address", async function () {
        await expect(apedToken.transfer(bob.address, getBigNumber(100)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(deployer.address, bob.address, getBigNumber(100));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(getBigNumber(100));
      });
    });

    describe("after the end of the restriction time", () => {
      beforeEach(async () => {
        await advanceTimeAndBlock(duration.days(7).toNumber());
      });

      it("should transfer correctly when user try to transfer", async function () {
        await expect(apedToken.connect(alice).transfer(bob.address, getBigNumber(100)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(alice.address, bob.address, getBigNumber(100));
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(900));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(getBigNumber(100));
      });

      it("should transferFrom correctly when user try to transferFrom", async function () {
        await apedToken.connect(alice).approve(bob.address, getBigNumber(100));
        await expect(apedToken.connect(bob).transferFrom(alice.address, bob.address, getBigNumber(100)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(alice.address, bob.address, getBigNumber(100));
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(900));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(getBigNumber(100));
      });

      it("should transferFrom correctly if transferred from unrestricted address", async function () {
        await apedToken.approve(unitRouterV2.address, getBigNumber(100));
        await expect(
          apedToken.connect(unitRouterV2).transferFrom(deployer.address, uniPairV2.address, getBigNumber(100))
        )
          .to.emit(apedToken, Event_Transfer)
          .withArgs(deployer.address, uniPairV2.address, getBigNumber(100));
        expect(await apedToken.balanceOf(uniPairV2.address)).to.be.equal(getBigNumber(100));
      });

      it("should transfer correctly if transferred by unrestricted address", async function () {
        await expect(apedToken.transfer(bob.address, getBigNumber(100)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(deployer.address, bob.address, getBigNumber(100));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(getBigNumber(100));
      });
    });
  });

  describe("taxableTransfers", () => {
    beforeEach(async () => {
      await advanceTimeAndBlock(duration.days(7).toNumber());
      await apedToken.transfer(uniPairV2.address, getBigNumber(100_000));
      await apedToken.transfer(bob.address, getBigNumber(1_000));
      await apedToken.connect(bob).approve(unitRouterV2.address, getBigNumber(1_000));
      await apedToken.updateTaxableDex(uniPairV2.address, true);
      await apedToken.updateBuyTax(200);
      await apedToken.updateSellTax(500);
      await apedToken.updateBeneficiary(beneficiary.address);
    });

    describe("when interacting with taxable address during taxability period", () => {
      it("should imply buy tax if the transfer is from taxable address", async function () {
        await expect(apedToken.connect(uniPairV2).transfer(alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(uniPairV2.address, alice.address, getBigNumber(980))
          .and.to.emit(apedToken, Event_Transfer)
          .withArgs(uniPairV2.address, beneficiary.address, getBigNumber(20));
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(980));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(getBigNumber(20));
      });

      it("should imply sell tax if the transfer is to taxable address", async function () {
        await expect(apedToken.connect(unitRouterV2).transferFrom(bob.address, uniPairV2.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, uniPairV2.address, getBigNumber(950))
          .and.to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, beneficiary.address, getBigNumber(50));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(uniPairV2.address)).to.be.equal(getBigNumber(100_950));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(getBigNumber(50));
      });

      it("should not imply buy tax if the transfer is from taxable address but to untaxable address", async function () {
        await apedToken.updateUntaxableAccount(alice.address, true);

        await expect(apedToken.connect(uniPairV2).transfer(alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(uniPairV2.address, alice.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(getBigNumber(0));
      });

      it("should not imply sell tax if the transfer is to taxable address but from untaxable address", async function () {
        await apedToken.updateUntaxableAccount(bob.address, true);

        await expect(apedToken.connect(unitRouterV2).transferFrom(bob.address, uniPairV2.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, uniPairV2.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(uniPairV2.address)).to.be.equal(getBigNumber(101_000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(0);
      });
    });

    describe("when doing normal p2p transfers during taxability period", () => {
      beforeEach(async () => {
        await advanceTimeAndBlock(duration.days(7).toNumber());
      });

      it("should not imply buy tax if the transfer is from normal address", async function () {
        await expect(apedToken.connect(bob).transfer(alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, alice.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(0);
      });

      it("should not imply sell tax if the transfer is to normal address", async function () {
        await expect(apedToken.connect(unitRouterV2).transferFrom(bob.address, alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, alice.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(0);
      });

      it("should not imply buy tax if the transfer is from normal address but to untaxable address", async function () {
        await apedToken.updateUntaxableAccount(alice.address, true);

        await expect(apedToken.connect(bob).transfer(alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, alice.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(getBigNumber(0));
      });

      it("should not imply sell tax if the transfer is to normal address but from untaxable address", async function () {
        await apedToken.updateUntaxableAccount(bob.address, true);

        await expect(apedToken.connect(unitRouterV2).transferFrom(bob.address, alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, alice.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(0);
      });
    });

    describe("when interacting after taxability renounced", () => {
      beforeEach(async () => {
        await apedToken.renounceTaxability();
      });

      it("should not imply buy tax if the transfer is from taxable address", async function () {
        await expect(apedToken.connect(uniPairV2).transfer(alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(uniPairV2.address, alice.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
        expect(await apedToken.balanceOf(uniPairV2.address)).to.be.equal(getBigNumber(99_000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(0);
      });

      it("should not imply sell tax if the transfer is to taxable address", async function () {
        await expect(apedToken.connect(unitRouterV2).transferFrom(bob.address, uniPairV2.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, uniPairV2.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(uniPairV2.address)).to.be.equal(getBigNumber(101_000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(0);
      });

      it("should not imply buy tax if the transfer is from taxable address but to untaxable address", async function () {
        await apedToken.updateUntaxableAccount(alice.address, true);

        await expect(apedToken.connect(uniPairV2).transfer(alice.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(uniPairV2.address, alice.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(alice.address)).to.be.equal(getBigNumber(1000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(getBigNumber(0));
      });

      it("should not imply sell tax if the transfer is to taxable address but from untaxable address", async function () {
        await apedToken.updateUntaxableAccount(bob.address, true);

        await expect(apedToken.connect(unitRouterV2).transferFrom(bob.address, uniPairV2.address, getBigNumber(1000)))
          .to.emit(apedToken, Event_Transfer)
          .withArgs(bob.address, uniPairV2.address, getBigNumber(1000));
        expect(await apedToken.balanceOf(bob.address)).to.be.equal(0);
        expect(await apedToken.balanceOf(uniPairV2.address)).to.be.equal(getBigNumber(101_000));
        expect(await apedToken.balanceOf(beneficiary.address)).to.be.equal(0);
      });
    });
  });

  describe("updateBuyTax()", () => {
    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).updateBuyTax(0)).to.be.revertedWith(Error_OwnableUnauthorizedAccount);
    });

    it("should revert if called after renounce of taxability", async function () {
      await apedToken.renounceTaxability();
      await expect(apedToken.updateBuyTax(1000)).to.be.revertedWith(Error_Forbidden);
    });

    it("should revert if buy tax > 10%", async function () {
      await expect(apedToken.updateBuyTax(1001)).to.be.revertedWith(Error_Overtaxed);
    });

    it("should correctly change buy tax", async function () {
      expect(await apedToken.buyTax()).to.be.equal(0);
      await expect(apedToken.updateBuyTax(999)).to.emit(apedToken, Event_UpdatedBuyTax).withArgs(999);
      expect(await apedToken.buyTax()).to.be.equal(999);
    });
  });

  describe("updateSellTax()", () => {
    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).updateSellTax(0)).to.be.revertedWith(Error_OwnableUnauthorizedAccount);
    });

    it("should revert if called after renounce of taxability", async function () {
      await apedToken.renounceTaxability();
      await expect(apedToken.updateSellTax(1000)).to.be.revertedWith(Error_Forbidden);
    });

    it("should revert if sell tax > 10%", async function () {
      await expect(apedToken.updateSellTax(1001)).to.be.revertedWith(Error_Overtaxed);
    });

    it("should correctly change sell tax", async function () {
      expect(await apedToken.sellTax()).to.be.equal(0);
      await expect(apedToken.updateSellTax(999)).to.emit(apedToken, Event_UpdatedSellTax).withArgs(999);
      expect(await apedToken.sellTax()).to.be.equal(999);
    });
  });

  describe("updateBeneficiary()", () => {
    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).updateBeneficiary(alice.address)).to.be.revertedWith(
        Error_OwnableUnauthorizedAccount
      );
    });

    it("should revert if called after renounce of taxability", async function () {
      await apedToken.renounceTaxability();
      await expect(apedToken.updateBeneficiary(deployer.address)).to.be.revertedWith(Error_Forbidden);
    });

    it("should revert if new beneficiary is zero address", async function () {
      await expect(apedToken.updateBeneficiary(ADDRESS_ZERO)).to.be.revertedWith(Error_ZeroAddress);
    });

    it("should correctly change beneficiary", async function () {
      expect(await apedToken.beneficiary()).to.be.equal(ADDRESS_ZERO);
      await expect(apedToken.updateBeneficiary(deployer.address))
        .to.emit(apedToken, Event_UpdatedBeneficiary)
        .withArgs(deployer.address);
      expect(await apedToken.beneficiary()).to.be.equal(deployer.address);
    });
  });

  describe("renounceTaxability()", () => {
    beforeEach(async () => {
      await apedToken.updateBuyTax(200);
      await apedToken.updateSellTax(500);
      await apedToken.updateBeneficiary(beneficiary.address);
    });

    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).renounceTaxability()).to.be.revertedWith(Error_OwnableUnauthorizedAccount);
    });

    it("should revert if called after renounce of taxability", async function () {
      await apedToken.renounceTaxability();
      await expect(apedToken.renounceTaxability()).to.be.revertedWith(Error_Forbidden);
    });

    it("should correctly set contract as not taxable", async function () {
      expect(await apedToken.buyTax()).to.be.equal(200);
      expect(await apedToken.sellTax()).to.be.equal(500);
      expect(await apedToken.beneficiary()).to.be.equal(beneficiary.address);
      expect(await apedToken.taxableTransfers()).to.be.equal(true);

      await expect(apedToken.renounceTaxability())
        .to.emit(apedToken, Event_UpdatedTaxableTransfers)
        .withArgs(false)
        .and.to.emit(apedToken, Event_UpdatedBuyTax)
        .withArgs(0)
        .and.to.emit(apedToken, Event_UpdatedSellTax)
        .withArgs(0)
        .and.to.emit(apedToken, Event_UpdatedBeneficiary)
        .withArgs(ADDRESS_ZERO);

      expect(await apedToken.buyTax()).to.be.equal(0);
      expect(await apedToken.sellTax()).to.be.equal(0);
      expect(await apedToken.beneficiary()).to.be.equal(ADDRESS_ZERO);
      expect(await apedToken.taxableTransfers()).to.be.equal(false);
    });
  });

  describe("updateTaxableDex()", () => {
    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).updateTaxableDex(uniPairV2.address, true)).to.be.revertedWith(
        Error_OwnableUnauthorizedAccount
      );
    });

    it("should do nothing if value is unchanged", async function () {
      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(false);
      await expect(apedToken.updateTaxableDex(uniPairV2.address, false)).to.not.emit(
        apedToken,
        Event_UpdatedTaxableDex
      );
      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(false);

      await apedToken.updateTaxableDex(uniPairV2.address, true);

      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(true);
      await expect(apedToken.updateTaxableDex(uniPairV2.address, true)).to.not.emit(apedToken, Event_UpdatedTaxableDex);
      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(true);
    });

    it("should correctly update taxable dex", async function () {
      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(false);
      await expect(apedToken.updateTaxableDex(uniPairV2.address, true))
        .to.emit(apedToken, Event_UpdatedTaxableDex)
        .withArgs(uniPairV2.address, true);
      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(true);

      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(true);
      await expect(apedToken.updateTaxableDex(uniPairV2.address, false))
        .to.emit(apedToken, Event_UpdatedTaxableDex)
        .withArgs(uniPairV2.address, false);
      expect(await apedToken.taxableDex(uniPairV2.address)).to.be.equal(false);
    });
  });

  describe("updateUntaxableAccount()", () => {
    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).updateUntaxableAccount(alice.address, true)).to.be.revertedWith(
        Error_OwnableUnauthorizedAccount
      );
    });

    it("should do nothing if value is unchanged", async function () {
      expect(await apedToken.untaxableAccount(deployer.address)).to.be.equal(true);
      await expect(apedToken.updateUntaxableAccount(deployer.address, true)).to.not.emit(
        apedToken,
        Event_UpdatedUntaxableAccount
      );
      expect(await apedToken.untaxableAccount(deployer.address)).to.be.equal(true);

      expect(await apedToken.untaxableAccount(alice.address)).to.be.equal(false);
      await expect(apedToken.updateUntaxableAccount(deployer.address, true)).to.not.emit(
        apedToken,
        Event_UpdatedUntaxableAccount
      );
      expect(await apedToken.untaxableAccount(alice.address)).to.be.equal(false);
    });

    it("should correctly update untaxable account", async function () {
      expect(await apedToken.untaxableAccount(alice.address)).to.be.equal(false);
      await expect(apedToken.updateUntaxableAccount(alice.address, true))
        .to.emit(apedToken, Event_UpdatedUntaxableAccount)
        .withArgs(alice.address, true);
      expect(await apedToken.untaxableAccount(alice.address)).to.be.equal(true);

      expect(await apedToken.untaxableAccount(deployer.address)).to.be.equal(true);
      await expect(apedToken.updateUntaxableAccount(deployer.address, false))
        .to.emit(apedToken, Event_UpdatedUntaxableAccount)
        .withArgs(deployer.address, false);
      expect(await apedToken.untaxableAccount(deployer.address)).to.be.equal(false);
    });
  });

  describe("updateUnrestrictedAccount()", () => {
    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).updateUnrestrictedAccount(alice.address, true)).to.be.revertedWith(
        Error_OwnableUnauthorizedAccount
      );
    });

    it("should do nothing if value is unchanged", async function () {
      expect(await apedToken.unrestrictedAccount(deployer.address)).to.be.equal(true);
      await expect(apedToken.updateUnrestrictedAccount(deployer.address, true)).to.not.emit(
        apedToken,
        Event_UpdatedUnrestrictedAccount
      );
      expect(await apedToken.unrestrictedAccount(deployer.address)).to.be.equal(true);

      expect(await apedToken.unrestrictedAccount(alice.address)).to.be.equal(false);
      await expect(apedToken.updateUnrestrictedAccount(deployer.address, true)).to.not.emit(
        apedToken,
        Event_UpdatedUnrestrictedAccount
      );
      expect(await apedToken.unrestrictedAccount(alice.address)).to.be.equal(false);
    });

    it("should correctly update unrestricted account", async function () {
      expect(await apedToken.unrestrictedAccount(alice.address)).to.be.equal(false);
      await expect(apedToken.updateUnrestrictedAccount(alice.address, true))
        .to.emit(apedToken, Event_UpdatedUnrestrictedAccount)
        .withArgs(alice.address, true);
      expect(await apedToken.unrestrictedAccount(alice.address)).to.be.equal(true);

      expect(await apedToken.unrestrictedAccount(deployer.address)).to.be.equal(true);
      await expect(apedToken.updateUnrestrictedAccount(deployer.address, false))
        .to.emit(apedToken, Event_UpdatedUnrestrictedAccount)
        .withArgs(deployer.address, false);
      expect(await apedToken.unrestrictedAccount(deployer.address)).to.be.equal(false);
    });
  });

  describe("updateRestrictedTransfersEndTime()", () => {
    it("should revert if not called by the owner", async function () {
      await expect(apedToken.connect(alice).updateRestrictedTransfersEndTime(now)).to.be.revertedWith(
        Error_OwnableUnauthorizedAccount
      );
    });

    it("should revert if called by the owner after restricted end time has passed", async function () {
      await apedToken.updateRestrictedTransfersEndTime(now);
      await expect(apedToken.updateRestrictedTransfersEndTime(now)).to.be.revertedWith(Error_Forbidden);
    });

    it("should correctly update restricted transfers end time ", async function () {
      expect(await apedToken.restrictedTransfersEndTime()).to.be.equal(now.add(duration.days(7)));
      await expect(apedToken.updateRestrictedTransfersEndTime(now.add(duration.days(1))))
        .to.emit(apedToken, Event_UpdatedRestrictedTransfersEndTime)
        .withArgs(now.add(duration.days(1)));
      expect(await apedToken.restrictedTransfersEndTime()).to.be.equal(now.add(duration.days(1)));
    });
  });
});
