const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3'); // Correct import statement
const web3 = new Web3(ganache.provider());

const compiledFactory = require('../ethereum/build/CampaignFactory.json');
const compiledCampaign = require('../ethereum/build/Campaign.json');
const { describe, it } = require('mocha');

let accounts;
let factory;
let campaignAddress;
let campaign;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    factory = await new web3.eth.Contract(JSON.parse(compiledFactory.interface))
        .deploy({ data: compiledFactory.bytecode })
        .send({ from: accounts[0], gas: '1000000' });

    await factory.methods.createCampaign('100').send({
        from: accounts[0], gas: '1000000'
    });

    const address = await factory.methods.getDeployedCampaigns().call();
    campaignAddress = address[0];

    campaign = await new web3.eth.Contract(
        JSON.parse(compiledCampaign.interface),
        campaignAddress);
});

describe('Campaign', () => {
    it('deploys a factory and a campaign', () => {
        assert.ok(factory.options.address);
        
        assert.ok(campaign.options.address);
    });

    it('marks caller as the campaign manager', async () => {
        const manager = await campaign.methods.manager().call();

        assert.equal(accounts[0], manager);
    });

    it('allows people to contribute money and marks them as approvers', async () => {
        await campaign.methods.contribute().send({
            value: '200',
            from: accounts[1]
        });

        const isContributor = await campaign.methods.approvers(accounts[1]).call();

        assert(isContributor);
    });

    it('requires a minium contribution', async () => {
        try {
            await campaign.methods.contribute().send({
                value: '5',
                from: accounts[1]
            });

            assert(false);
        } catch (error) {
            assert(error);
        }
    });

    it('allows a manager to make a payment request', async () => {
        await campaign.methods.createRequest('Buy batteries', 
                                             '1000', 
                                             accounts[1]).send({from: accounts[0],
                                                                        gas: '1000000'});

        const request = await campaign.methods.requests(0).call();

        assert.equal('Buy batteries', request.description);
        assert.equal('1000', request.value);
        assert.equal(accounts[1], request.recipient);
        assert.equal(false, request.complete);
        assert.equal('0', request.approvalCount);
    });

    it('processes requests', async () => {
        await campaign.methods.contribute().send({
            from: accounts[0],
            value: web3.utils.toWei('10', 'ether')
        });
    
        await campaign.methods.createRequest('Buy batteries', 
                                            web3.utils.toWei('5', 'ether'), 
                                            accounts[1]).send({
            from: accounts[0],
            gas: '1000000'
        });
    
        await campaign.methods.approveRequest(0).send({
            from: accounts[0],
            gas: '1000000'
        });
    
        await campaign.methods.finalizeRequest(0).send({
            from: accounts[0],
            gas: '1000000'
        });
    
        let balance = await web3.eth.getBalance(accounts[1]);
        balance = web3.utils.fromWei(balance, 'ether');
        balance = parseFloat(balance);
    
        assert(balance > 104);
    });
})