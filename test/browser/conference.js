'use strict';

import { PeerUser } from '../peer-user.js';
import { expectEvents, updateRemoteVideos, sleep } from '../helper.js';
import config from './config.js'

const assert = chai.assert;
let client;
let peerUser1, peerUser2;
let call;
describe('Conference Call', async function() {
    this.timeout(300000);

    before(async function() {
        Circuit.logger.setLevel(Circuit.Enums.LogLevel.Error);
        client = new Circuit.Client(config.config);
        const res = await Promise.all([PeerUser.create(), PeerUser.create(), client.logon(config.credentials)]);
        peerUser1 = res[0];
        peerUser2 = res[1];
    });

    after(async function() {
        document.querySelector('#localVideo').srcObject = null;
        await Promise.all([peerUser1.destroy(), peerUser2.destroy(), client.logout()]);
    });

    afterEach(async function() {
        client.removeAllListeners();
    });

    it('functions: [createGroupConversation, startConference], with event: callStatus with states: [Initiated, Waiting]', async () => {
        const conversation = await client.createGroupConversation([peerUser1.userId, peerUser2.userId], 'SDK Test: Conference Call');
        assert(!!conversation, 'createGroupConversation not successful');
        call = await client.startConference(conversation.convId, {audio: false, video: false});
        await expectEvents(client, [{
            type: 'callStatus',
            predicate: evt => evt.call.state === Circuit.Enums.CallStateName.Initiated
        }, {
            type: 'callStatus',
            predicate: evt => evt.call.state === Circuit.Enums.CallStateName.Waiting
        }]);
        document.querySelector('#localVideo').srcObject = call.localVideoStream;
        assert(call.callId);
    });

    it('function: joinConference, with event: callStatus with reaons: [callStateChanged, participantJoined]', async () => {
        await sleep(5000); // wait to make sure the call is ready to be joined
        updateRemoteVideos(client);
        const res = await Promise.all([
            peerUser1.exec('joinConference', call.callId, {audio: false, video: false}),
            peerUser2.exec('joinConference', call.callId, {audio: false, video: false}),
            expectEvents(client, [{
                type: 'callStatus',
                predicate: evt => evt.reason === 'callStateChanged' && evt.call.state === Circuit.Enums.CallStateName.Active
            }, {
                type: 'callStatus',
                predicate: evt => evt.reason === 'participantJoined'
            }])
        ]);
        assert(res[2].call.callId === call.callId);
    });

    it('function: endConference, with event: callEnded', async () => {
        updateRemoteVideos(client);
        const res = await Promise.all([client.endConference(call.callId), expectEvents(client, ['callEnded'])]);
        assert(res[1].call.callId === call.callId);
    });
});
