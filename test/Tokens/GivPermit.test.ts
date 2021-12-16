import { ethers } from "hardhat";
import { expect } from "chai";
import { describe, beforeEach, it } from "mocha";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractFactory } from "ethers";
import { fromRpcSig } from "ethereumjs-util";
import ethSigUtil from "@nomiclabs/eth-sig-util";
import { EIP712Domain, domainSeparator } from "../utils/eip712";
import { GIVPermitMock } from "../../typechain-types";

const { parseEther: toWei } = ethers.utils;

const Permit = [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
];

let giv: GIVPermitMock,
    initalHolder: SignerWithAddress,
    spender: SignerWithAddress,
    recipient: SignerWithAddress,
    other: SignerWithAddress,
    addrs: Array<SignerWithAddress>;
let initalHolderAddress: string,
    spenderAddress: string,
    recipientAddress: string,
    otherAddress: string;
let chainID: BigNumber;

const initalSupply = toWei("100");

describe("GIV Token Permit", () => {
    beforeEach(async () => {
        [initalHolder, spender, recipient, other, ...addrs] =
            await ethers.getSigners();
        initalHolderAddress = await initalHolder.getAddress();

        const givTokenFactory = await ethers.getContractFactory(
            "GIVPermitMock",
        );
        giv = (await givTokenFactory.deploy(
            initalHolderAddress,
            initalSupply,
        )) as GIVPermitMock;

        chainID = await giv._getChainId();
    });

    it("inital nonce is 0", async () => {
        expect(await giv.nonces(initalHolderAddress)).to.be.eq(0);
    });

    it("domain separator", async () => {
        expect(await giv.getDomainSeparator());
    });
});
