// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "../Tokens/Token.sol";

contract GIVPermitMock is GIV {
    /// @dev Initialize GIV with msg.sender as minter
    constructor(address initialAccount, uint256 initialBalance)
        payable
        GIV(msg.sender)
    {
        _mint(initialAccount, initialBalance);
    }

    function _getChainId() public view returns (uint256) {
        return block.chainid;
    }
}
