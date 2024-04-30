// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

import { Errors } from "./libraries/Errors.sol";

/**
 * @title APED
 *
 * @notice An implementation of the ERC20 token with optional taxable dex swaps.
 *
 * @dev The implementation has the ability to turn on the period of restricted
 * transfers, during which only unrestricted addresses can transfer tokens. The
 * smart contract owner has the ability to change the duration of the
 * period, but only if the period is still running.
 *
 * @dev Tax is charged during interaction with marked taxable dex.
 * Normal p2p transfers are not taxable.
 * Tax can differ if the swap is sell or buy operation, but can't be bigger then 10%.
 * Tax is transferred to beneficiary address.
 * There is an option to permanently disable taxation.
 * In addition, the smart contract has the ability to mark the address as untaxed.
 */
contract APED is ERC20, ERC20Burnable, ERC20Permit, Ownable2Step {
    uint256 private constant TAX_DENOMINATOR = 10000;

    /// @notice Buy tax value.
    uint256 public buyTax;
    /// @notice Sell tax value.
    uint256 public sellTax;
    /// @notice Address of tax beneficiary.
    address public beneficiary;
    /// @notice Determinate if buy/sell operations are taxable.
    bool public taxableTransfers;
    /// @notice mapping of dex pairs that are taxable.
    mapping(address => bool) public taxableDex;
    /// @notice mapping of addresses that are transfer untaxable.
    mapping(address => bool) public untaxableAccount;
    /// @notice mapping of addresses that are transfer unrestricted.
    mapping(address => bool) public unrestrictedAccount;
    /// @notice Timestamp after which transfers will be available.
    uint256 public restrictedTransfersEndTime;

    /**
     * @notice Event emitted when the value of `buyTax` has been updated.
     * @param buyTax The value of the new buy tax.
     */
    event UpdatedBuyTax(uint256 buyTax);

    /**
     * @notice Event emitted when the value of `sellTax` has been updated.
     * @param sellTax The value of the new sell tax.
     */
    event UpdatedSellTax(uint256 sellTax);

    /**
     * @notice Event emitted when the value of tax `beneficiary` has been updated.
     * @param beneficiary The address of the new tax beneficiary.
     */
    event UpdatedBeneficiary(address beneficiary);

    /**
     * @notice Event emitted when the value of `taxableTransfers` has been updated.
     * @param taxable The value of the new taxable transfers indicator.
     */
    event UpdatedTaxableTransfers(bool taxable);

    /**
     * @notice Event emitted when the value of `taxableDex` has been updated.
     * @param dex the dex address that has been updated.
     * @param taxable the new value given to account.
     */
    event UpdatedTaxableDex(address dex, bool taxable);

    /**
     * @notice Event emitted when the value of `untaxableAccount` has been updated.
     * @param account the account address that has been updated.
     * @param untaxable the new value given to account.
     */
    event UpdatedUntaxableAccount(address account, bool untaxable);

    /**
     * @notice Event emitted when the value of `unrestrictedAccount` has been updated.
     * @param account the account address that has been updated.
     * @param unrestricted the new value given to account.
     */
    event UpdatedUnrestrictedAccount(address account, bool unrestricted);

    /**
     * @notice Event emitted when the value of `restrictedTransfersEndTime` has been updated.
     * @param timestamp The value of the new timestamp.
     */
    event UpdatedRestrictedTransfersEndTime(uint256 timestamp);

    /**
     * @notice Ensures that taxability was not renounced.
     */
    modifier onlyWhenTaxable() {
        if (!taxableTransfers) revert Errors.Forbidden();
        _;
    }

    /**
     * @notice Contract constructor.
     */
    constructor()
        ERC20("APED", "APED")
        ERC20Permit("APED")
        Ownable(msg.sender)
    {
        _mint(msg.sender, 100_000_000 * 10 ** 18);

        untaxableAccount[msg.sender] = true;
        unrestrictedAccount[msg.sender] = true;
        taxableTransfers = true;
        restrictedTransfersEndTime = block.timestamp + 7 days;

        emit UpdatedUntaxableAccount(msg.sender, true);
        emit UpdatedUnrestrictedAccount(msg.sender, true);
        emit UpdatedTaxableTransfers(true);
        emit UpdatedRestrictedTransfersEndTime(block.timestamp + 7 days);
    }

    /**
     * @notice Updates the value of the `buyTax`.
     * @param buyTax_ The value of the new buy tax.
     */
    function updateBuyTax(uint256 buyTax_) external onlyOwner onlyWhenTaxable {
        if (buyTax_ > 1000) revert Errors.Overtaxed();

        buyTax = buyTax_;

        emit UpdatedBuyTax(buyTax_);
    }

    /**
     * @notice Updates the value of the `buyTax`.
     * @param sellTax_ The value of the new buy tax.
     */
    function updateSellTax(
        uint256 sellTax_
    ) external onlyOwner onlyWhenTaxable {
        if (sellTax_ > 1000) revert Errors.Overtaxed();

        sellTax = sellTax_;

        emit UpdatedSellTax(sellTax_);
    }

    /**
     * @notice Updates the address of the tax `beneficiary`.
     * @param beneficiary_ The address of the new beneficiary.
     */
    function updateBeneficiary(
        address beneficiary_
    ) external onlyOwner onlyWhenTaxable {
        if (beneficiary_ == address(0)) revert Errors.ZeroAddress();

        beneficiary = beneficiary_;

        emit UpdatedBeneficiary(beneficiary_);
    }

    /**
     * @notice Renounce taxation on token transfers.
     * @dev One time function.
     */
    function renounceTaxability() external onlyOwner onlyWhenTaxable {
        sellTax = 0;
        buyTax = 0;
        beneficiary = address(0);
        taxableTransfers = false;

        emit UpdatedSellTax(0);
        emit UpdatedBuyTax(0);
        emit UpdatedBeneficiary(address(0));
        emit UpdatedTaxableTransfers(false);
    }

    /**
     * @notice Updates the value of `taxableDex`.
     * @param dex the dex address that is updated.
     * @param taxable the new value given to account.
     */
    function updateTaxableDex(address dex, bool taxable) external onlyOwner {
        if (taxableDex[dex] != taxable) {
            taxableDex[dex] = taxable;

            emit UpdatedTaxableDex(dex, taxable);
        }
    }

    /**
     * @notice Updates the value of `untaxableAccount`.
     * @param account the account address that is updated.
     * @param untaxable the new value given to account.
     */
    function updateUntaxableAccount(
        address account,
        bool untaxable
    ) external onlyOwner {
        if (untaxableAccount[account] != untaxable) {
            untaxableAccount[account] = untaxable;

            emit UpdatedUntaxableAccount(account, untaxable);
        }
    }

    /**
     * @notice Updates the value of `unrestrictedAccount`.
     * @param account the account address that is updated.
     * @param unrestricted the new value given to account.
     */
    function updateUnrestrictedAccount(
        address account,
        bool unrestricted
    ) external onlyOwner {
        if (unrestrictedAccount[account] != unrestricted) {
            unrestrictedAccount[account] = unrestricted;

            emit UpdatedUnrestrictedAccount(account, unrestricted);
        }
    }

    /**
     * @notice Updates the timestamp after which transfers will be available.
     * @param timestamp The value of the new timestamp.
     */
    function updateRestrictedTransfersEndTime(
        uint256 timestamp
    ) external onlyOwner {
        if (block.timestamp > restrictedTransfersEndTime)
            revert Errors.Forbidden();

        restrictedTransfersEndTime = timestamp;

        emit UpdatedRestrictedTransfersEndTime(timestamp);
    }

    /**
     * @dev Checks if the sender is authorized to make transfer during the period
     * of restricted transfers.
     *
     * @dev Calculates the tax by which the transferred amount should be reduced.
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (block.timestamp < restrictedTransfersEndTime) {
            bool unrestricted = unrestrictedAccount[msg.sender] ||
                unrestrictedAccount[from];

            if (!unrestricted) revert Errors.Forbidden();
        }

        if (taxableTransfers) {
            (uint256 tax, uint256 reminder) = _computeTax(from, to, amount);

            if (tax > 0) {
                super._update(from, address(beneficiary), tax);
            }

            super._update(from, to, reminder);
        } else {
            super._update(from, to, amount);
        }
    }

    /**
     * @notice Calculate the tax depending on the transfer parties.
     *
     * @param from Address of the sender.
     * @param to Address of the recipient.
     * @param amount Amount of the tokens.
     *
     * @return tax The value of calculated tax.
     * @return remainder The amount reduced by calculated tax.
     */
    function _computeTax(
        address from,
        address to,
        uint256 amount
    ) private view returns (uint256 tax, uint256 remainder) {
        if (taxableDex[to]) {
            if (untaxableAccount[from]) return (tax, amount);

            unchecked {
                tax = (amount * sellTax) / TAX_DENOMINATOR;
                remainder = amount - tax;
            }

            return (tax, remainder);
        } else if (taxableDex[from]) {
            if (untaxableAccount[to]) return (tax, amount);

            unchecked {
                tax = (amount * buyTax) / TAX_DENOMINATOR;
                remainder = amount - tax;
            }

            return (tax, remainder);
        }

        return (tax, amount);
    }
}
