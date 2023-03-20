import { fromBase64, fromHex } from '@cosmjs/encoding';
import { logs } from '@cosmjs/stargate';
import {
  fromRfc3339WithNanoseconds,
  ReadonlyDateWithNanoseconds,
  tendermint37,
} from '@cosmjs/tendermint-rpc';
import test from 'ava';
import Long from 'long';

import {
  heightGreater,
  parseHeightAttribute,
  parsePacketsFromEvents,
  parsePacketsFromLogs,
  parseRevisionNumber,
  secondsFromDateNanos,
  stringifyEvent,
  timeGreater,
  timestampFromDateNanos,
} from './utils';

test('stringifyEvent works', (t) => {
  const event = stringifyEvent({
    type: 'coin_spent',
    attributes: [
      {
        key: fromBase64('c3BlbmRlcg==').toString(),
        value: fromBase64(
          'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg=='
        ).toString(),
      },
      {
        key: fromBase64('YW1vdW50').toString(),
        value: fromBase64('MzY5NDV1anVub3g=').toString(),
      },
    ],
  });
  t.deepEqual(event, {
    type: 'coin_spent',
    attributes: [
      {
        key: 'spender',
        value: 'juno100s45s4h94qdkcafmmrqfltlrgyqwyn6e05jx2',
      },
      {
        key: 'amount',
        value: '36945ujunox',
      },
    ],
  });

  // Invalid key in one attribute
  const event2 = stringifyEvent({
    type: 'coin_spent',
    attributes: [
      {
        key: new Uint8Array([0, 159, 146, 150]).toString(),
        value: fromBase64(
          'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg=='
        ).toString(),
      },
      {
        key: fromBase64('YW1vdW50').toString(),
        value: fromBase64('MzY5NDV1anVub3g=').toString(),
      },
    ],
  });
  t.deepEqual(event2, {
    type: 'coin_spent',
    attributes: [
      {
        key: '\0���',
        value: 'juno100s45s4h94qdkcafmmrqfltlrgyqwyn6e05jx2',
      },
      {
        key: 'amount',
        value: '36945ujunox',
      },
    ],
  });

  // Invalid value in one attribute
  const event3 = stringifyEvent({
    type: 'coin_spent',
    attributes: [
      {
        key: fromBase64('c3BlbmRlcg==').toString(),
        // https://play.rust-lang.org/?version=stable&mode=debug&edition=2021&gist=7c1a7f484132afdebfa19b65dab60bbd
        value: new Uint8Array([
          72, 101, 108, 108, 111, 32, 240, 144, 128, 87, 111, 114, 108, 100,
        ]).toString(),
      },
      {
        key: fromBase64('YW1vdW50').toString(),
        value: fromBase64('MzY5NDV1anVub3g=').toString(),
      },
    ],
  });
  t.deepEqual(event3, {
    type: 'coin_spent',
    attributes: [
      {
        key: 'spender',
        value: 'Hello �World',
      },
      {
        key: 'amount',
        value: '36945ujunox',
      },
    ],
  });
});

test('parsePacketsFromEvents', (t) => {
  // From https://gist.github.com/webmaster128/14d273b3b462c1c653f51e3e1edb8cd5
  const events: tendermint37.Event[] = [
    {
      type: 'coin_spent',
      attributes: [
        {
          key: fromBase64('c3BlbmRlcg==').toString(),
          value: fromBase64(
            'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg=='
          ).toString(),
        },
        {
          key: fromBase64('YW1vdW50').toString(),
          value: fromBase64('MzY5NDV1anVub3g=').toString(),
        },
      ],
    },
    {
      type: 'coin_received',
      attributes: [
        {
          key: fromBase64('cmVjZWl2ZXI=').toString(),
          value: fromBase64(
            'anVubzE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHh0cW12cA=='
          ).toString(),
        },
        {
          key: fromBase64('YW1vdW50').toString(),
          value: fromBase64('MzY5NDV1anVub3g=').toString(),
        },
      ],
    },
    {
      type: 'transfer',
      attributes: [
        {
          key: fromBase64('cmVjaXBpZW50').toString(),
          value: fromBase64(
            'anVubzE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHh0cW12cA=='
          ).toString(),
        },
        {
          key: fromBase64('c2VuZGVy').toString(),
          value: fromBase64(
            'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg=='
          ).toString(),
        },
        {
          key: fromBase64('YW1vdW50').toString(),
          value: fromBase64('MzY5NDV1anVub3g=').toString(),
        },
      ],
    },
    {
      type: 'message',
      attributes: [
        {
          key: fromBase64('c2VuZGVy').toString(),
          value: fromBase64(
            'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg=='
          ).toString(),
        },
      ],
    },
    {
      type: 'tx',
      attributes: [
        {
          key: fromBase64('ZmVl').toString(),
          value: fromBase64('MzY5NDV1anVub3g=').toString(),
        },
      ],
    },
    {
      type: 'tx',
      attributes: [
        {
          key: fromBase64('YWNjX3NlcQ==').toString(),
          value: fromBase64(
            'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mi8xMjQ5Mg=='
          ).toString(),
        },
      ],
    },
    {
      type: 'tx',
      attributes: [
        {
          key: fromBase64('c2lnbmF0dXJl').toString(),
          value: fromBase64(
            'Sm42eW9WYlFPdFIxWlNHRW1lQmQ4c2VaOTl5RHlqdlJ2eU8rR1hGL1FGaDh3bzR2Tm5EckFFUzNxNmk0Sy9XTnhhdkNFRDAxVXNSK0hJYVB2djdRNkE9PQ=='
          ).toString(),
        },
      ],
    },
    {
      type: 'message',
      attributes: [
        {
          key: fromBase64('YWN0aW9u').toString(),
          value: fromBase64(
            'L2Nvc213YXNtLndhc20udjEuTXNnRXhlY3V0ZUNvbnRyYWN0'
          ).toString(),
        },
      ],
    },
    {
      type: 'message',
      attributes: [
        {
          key: fromBase64('bW9kdWxl').toString(),
          value: fromBase64('d2FzbQ==').toString(),
        },
        {
          key: fromBase64('c2VuZGVy').toString(),
          value: fromBase64(
            'anVubzEwMHM0NXM0aDk0cWRrY2FmbW1ycWZsdGxyZ3lxd3luNmUwNWp4Mg=='
          ).toString(),
        },
      ],
    },
    {
      type: 'execute',
      attributes: [
        {
          key: fromBase64('X2NvbnRyYWN0X2FkZHJlc3M=').toString(),
          value: fromBase64(
            'anVubzE0eWYyNHBmY3pjc2xjaGRyMDR1NXAyeXc5enhmNmN2czN2aGU5cjlzcmY1cGc2eTJwN25xZHFuN2tu'
          ).toString(),
        },
      ],
    },
    {
      type: 'execute',
      attributes: [
        {
          key: fromBase64('X2NvbnRyYWN0X2FkZHJlc3M=').toString(),
          value: fromBase64(
            'anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5'
          ).toString(),
        },
      ],
    },
    {
      type: 'wasm',
      attributes: [
        {
          key: fromBase64('X2NvbnRyYWN0X2FkZHJlc3M=').toString(),
          value: fromBase64(
            'anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5'
          ).toString(),
        },
        {
          key: fromBase64('YWN0aW9u').toString(),
          value: fromBase64('ZXhlY3V0ZV9nZXRfbmV4dF9yYW5kb21uZXNz').toString(),
        },
      ],
    },
    {
      type: 'send_packet',
      attributes: [
        {
          key: fromBase64('cGFja2V0X2NoYW5uZWxfb3JkZXJpbmc=').toString(),
          value: fromBase64('T1JERVJfVU5PUkRFUkVE').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2Nvbm5lY3Rpb24=').toString(),
          value: fromBase64('Y29ubmVjdGlvbi0zMQ==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RhdGE=').toString(),
          value: fromBase64(
            'eyJhZnRlciI6IjE2NjYxNjkwMDM0MTM1NzgyNjkiLCJzZW5kZXIiOiJqdW5vMTR5ZjI0cGZjemNzbGNoZHIwNHU1cDJ5dzl6eGY2Y3ZzM3ZoZTlyOXNyZjVwZzZ5MnA3bnFkcW43a24iLCJqb2JfaWQiOiJzaW1vbi1yb2xsLTEifQ=='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RhdGFfaGV4').toString(),
          value: fromBase64(
            'N2IyMjYxNjY3NDY1NzIyMjNhMjIzMTM2MzYzNjMxMzYzOTMwMzAzMzM0MzEzMzM1MzczODMyMzYzOTIyMmMyMjczNjU2ZTY0NjU3MjIyM2EyMjZhNzU2ZTZmMzEzNDc5NjYzMjM0NzA2NjYzN2E2MzczNmM2MzY4NjQ3MjMwMzQ3NTM1NzAzMjc5NzczOTdhNzg2NjM2NjM3NjczMzM3NjY4NjUzOTcyMzk3MzcyNjYzNTcwNjczNjc5MzI3MDM3NmU3MTY0NzE2ZTM3NmI2ZTIyMmMyMjZhNmY2MjVmNjk2NDIyM2EyMjczNjk2ZDZmNmUyZDcyNmY2YzZjMmQzMTIyN2Q='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RzdF9jaGFubmVs').toString(),
          value: fromBase64('Y2hhbm5lbC0xMA==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RzdF9wb3J0').toString(),
          value: fromBase64(
            'd2FzbS5ub2lzMWo3bTRmNjhscnVjZWc1eHEzZ2ZrZmRnZGd6MDJ2aHZscTJwNjd2Zjl2M2h3ZHlkYWF0M3NhanpjeTU='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NlcXVlbmNl').toString(),
          value: fromBase64('NzUyNA==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NyY19jaGFubmVs').toString(),
          value: fromBase64('Y2hhbm5lbC00Mg==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NyY19wb3J0').toString(),
          value: fromBase64(
            'd2FzbS5qdW5vMWU3dnM3Nm1hcmtzaHVzMzlleWZlZmgyeTN0OWd1Z2U0dDBrdnF5YTNxNnZhbWdzZWpoNHE4bHh0cTk='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X3RpbWVvdXRfaGVpZ2h0').toString(),
          value: fromBase64('MC0w').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3RpbWVvdXRfdGltZXN0YW1w').toString(),
          value: fromBase64('MTY2NjE3MjYwMDQxMzU3ODI2OQ==').toString(),
        },
      ],
    },
    {
      type: 'execute',
      attributes: [
        {
          key: fromBase64('X2NvbnRyYWN0X2FkZHJlc3M=').toString(),
          value: fromBase64(
            'anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5'
          ).toString(),
        },
      ],
    },
    {
      type: 'wasm',
      attributes: [
        {
          key: fromBase64('X2NvbnRyYWN0X2FkZHJlc3M=').toString(),
          value: fromBase64(
            'anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5'
          ).toString(),
        },
        {
          key: fromBase64('YWN0aW9u').toString(),
          value: fromBase64('ZXhlY3V0ZV9nZXRfbmV4dF9yYW5kb21uZXNz').toString(),
        },
      ],
    },
    {
      type: 'send_packet',
      attributes: [
        {
          key: fromBase64('cGFja2V0X2NoYW5uZWxfb3JkZXJpbmc=').toString(),
          value: fromBase64('T1JERVJfVU5PUkRFUkVE').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2Nvbm5lY3Rpb24=').toString(),
          value: fromBase64('Y29ubmVjdGlvbi0zMQ==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RhdGE=').toString(),
          value: fromBase64(
            'eyJhZnRlciI6IjE2NjYxNjkwMDM0MTM1NzgyNjkiLCJzZW5kZXIiOiJqdW5vMTR5ZjI0cGZjemNzbGNoZHIwNHU1cDJ5dzl6eGY2Y3ZzM3ZoZTlyOXNyZjVwZzZ5MnA3bnFkcW43a24iLCJqb2JfaWQiOiJzaW1vbi1yb2xsLTIifQ=='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RhdGFfaGV4').toString(),
          value: fromBase64(
            'N2IyMjYxNjY3NDY1NzIyMjNhMjIzMTM2MzYzNjMxMzYzOTMwMzAzMzM0MzEzMzM1MzczODMyMzYzOTIyMmMyMjczNjU2ZTY0NjU3MjIyM2EyMjZhNzU2ZTZmMzEzNDc5NjYzMjM0NzA2NjYzN2E2MzczNmM2MzY4NjQ3MjMwMzQ3NTM1NzAzMjc5NzczOTdhNzg2NjM2NjM3NjczMzM3NjY4NjUzOTcyMzk3MzcyNjYzNTcwNjczNjc5MzI3MDM3NmU3MTY0NzE2ZTM3NmI2ZTIyMmMyMjZhNmY2MjVmNjk2NDIyM2EyMjczNjk2ZDZmNmUyZDcyNmY2YzZjMmQzMjIyN2Q='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RzdF9jaGFubmVs').toString(),
          value: fromBase64('Y2hhbm5lbC0xMA==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RzdF9wb3J0').toString(),
          value: fromBase64(
            'd2FzbS5ub2lzMWo3bTRmNjhscnVjZWc1eHEzZ2ZrZmRnZGd6MDJ2aHZscTJwNjd2Zjl2M2h3ZHlkYWF0M3NhanpjeTU='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NlcXVlbmNl').toString(),
          value: fromBase64('NzUyNQ==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NyY19jaGFubmVs').toString(),
          value: fromBase64('Y2hhbm5lbC00Mg==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NyY19wb3J0').toString(),
          value: fromBase64(
            'd2FzbS5qdW5vMWU3dnM3Nm1hcmtzaHVzMzlleWZlZmgyeTN0OWd1Z2U0dDBrdnF5YTNxNnZhbWdzZWpoNHE4bHh0cTk='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X3RpbWVvdXRfaGVpZ2h0').toString(),
          value: fromBase64('MC0w').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3RpbWVvdXRfdGltZXN0YW1w').toString(),
          value: fromBase64('MTY2NjE3MjYwMDQxMzU3ODI2OQ==').toString(),
        },
      ],
    },
    {
      type: 'execute',
      attributes: [
        {
          key: fromBase64('X2NvbnRyYWN0X2FkZHJlc3M=').toString(),
          value: fromBase64(
            'anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5'
          ).toString(),
        },
      ],
    },
    {
      type: 'wasm',
      attributes: [
        {
          key: fromBase64('X2NvbnRyYWN0X2FkZHJlc3M=').toString(),
          value: fromBase64(
            'anVubzFlN3ZzNzZtYXJrc2h1czM5ZXlmZWZoMnkzdDlndWdlNHQwa3ZxeWEzcTZ2YW1nc2VqaDRxOGx4dHE5'
          ).toString(),
        },
        {
          key: fromBase64('YWN0aW9u').toString(),
          value: fromBase64('ZXhlY3V0ZV9nZXRfbmV4dF9yYW5kb21uZXNz').toString(),
        },
      ],
    },
    {
      type: 'send_packet',
      attributes: [
        {
          key: fromBase64('cGFja2V0X2NoYW5uZWxfb3JkZXJpbmc=').toString(),
          value: fromBase64('T1JERVJfVU5PUkRFUkVE').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2Nvbm5lY3Rpb24=').toString(),
          value: fromBase64('Y29ubmVjdGlvbi0zMQ==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RhdGE=').toString(),
          value: fromBase64(
            'eyJhZnRlciI6IjE2NjYxNjkwMDM0MTM1NzgyNjkiLCJzZW5kZXIiOiJqdW5vMTR5ZjI0cGZjemNzbGNoZHIwNHU1cDJ5dzl6eGY2Y3ZzM3ZoZTlyOXNyZjVwZzZ5MnA3bnFkcW43a24iLCJqb2JfaWQiOiJzaW1vbi1yb2xsLTMifQ=='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RhdGFfaGV4').toString(),
          value: fromBase64(
            'N2IyMjYxNjY3NDY1NzIyMjNhMjIzMTM2MzYzNjMxMzYzOTMwMzAzMzM0MzEzMzM1MzczODMyMzYzOTIyMmMyMjczNjU2ZTY0NjU3MjIyM2EyMjZhNzU2ZTZmMzEzNDc5NjYzMjM0NzA2NjYzN2E2MzczNmM2MzY4NjQ3MjMwMzQ3NTM1NzAzMjc5NzczOTdhNzg2NjM2NjM3NjczMzM3NjY4NjUzOTcyMzk3MzcyNjYzNTcwNjczNjc5MzI3MDM3NmU3MTY0NzE2ZTM3NmI2ZTIyMmMyMjZhNmY2MjVmNjk2NDIyM2EyMjczNjk2ZDZmNmUyZDcyNmY2YzZjMmQzMzIyN2Q='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RzdF9jaGFubmVs').toString(),
          value: fromBase64('Y2hhbm5lbC0xMA==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X2RzdF9wb3J0').toString(),
          value: fromBase64(
            'd2FzbS5ub2lzMWo3bTRmNjhscnVjZWc1eHEzZ2ZrZmRnZGd6MDJ2aHZscTJwNjd2Zjl2M2h3ZHlkYWF0M3NhanpjeTU='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NlcXVlbmNl').toString(),
          value: fromBase64('NzUyNg==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NyY19jaGFubmVs').toString(),
          value: fromBase64('Y2hhbm5lbC00Mg==').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3NyY19wb3J0').toString(),
          value: fromBase64(
            'd2FzbS5qdW5vMWU3dnM3Nm1hcmtzaHVzMzlleWZlZmgyeTN0OWd1Z2U0dDBrdnF5YTNxNnZhbWdzZWpoNHE4bHh0cTk='
          ).toString(),
        },
        {
          key: fromBase64('cGFja2V0X3RpbWVvdXRfaGVpZ2h0').toString(),
          value: fromBase64('MC0w').toString(),
        },
        {
          key: fromBase64('cGFja2V0X3RpbWVvdXRfdGltZXN0YW1w').toString(),
          value: fromBase64('MTY2NjE3MjYwMDQxMzU3ODI2OQ==').toString(),
        },
      ],
    },
  ];

  // See https://testnet.mintscan.io/juno-testnet/txs/F64B8C6A320A9C25FD1EA60B00194817B069C9CBEF19B736117D9339F33F2E51
  // for packet logs
  const packets = parsePacketsFromEvents(events);
  t.is(packets.length, 3);
  const [packet0, packet1, packet2] = packets;
  t.deepEqual(packet0, {
    sequence: Long.fromNumber(7524),
    sourcePort:
      'wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9',
    sourceChannel: 'channel-42',
    destinationPort:
      'wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5',
    destinationChannel: 'channel-10',
    data: fromHex(
      '7b226166746572223a2231363636313639303033343133353738323639222c2273656e646572223a226a756e6f3134796632347066637a63736c636864723034753570327977397a7866366376733376686539723973726635706736793270376e7164716e376b6e222c226a6f625f6964223a2273696d6f6e2d726f6c6c2d31227d'
    ),
    timeoutHeight: undefined,
    timeoutTimestamp: Long.fromString('1666172600413578269'),
  });
  t.deepEqual(packet1, {
    sequence: Long.fromNumber(7525),
    sourcePort:
      'wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9',
    sourceChannel: 'channel-42',
    destinationPort:
      'wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5',
    destinationChannel: 'channel-10',
    data: fromHex(
      '7b226166746572223a2231363636313639303033343133353738323639222c2273656e646572223a226a756e6f3134796632347066637a63736c636864723034753570327977397a7866366376733376686539723973726635706736793270376e7164716e376b6e222c226a6f625f6964223a2273696d6f6e2d726f6c6c2d32227d'
    ),
    timeoutHeight: undefined,
    timeoutTimestamp: Long.fromString('1666172600413578269'),
  });
  t.deepEqual(packet2, {
    sequence: Long.fromNumber(7526),
    sourcePort:
      'wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9',
    sourceChannel: 'channel-42',
    destinationPort:
      'wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5',
    destinationChannel: 'channel-10',
    data: fromHex(
      '7b226166746572223a2231363636313639303033343133353738323639222c2273656e646572223a226a756e6f3134796632347066637a63736c636864723034753570327977397a7866366376733376686539723973726635706736793270376e7164716e376b6e222c226a6f625f6964223a2273696d6f6e2d726f6c6c2d33227d'
    ),
    timeoutHeight: undefined,
    timeoutTimestamp: Long.fromString('1666172600413578269'),
  });
});

test('parsePacketsFromLogs works for one packet', (t) => {
  // curl -sS "https://juno-testnet-rpc.polkachu.com/tx?hash=0x502E6F4AEA3FB185DD894D0DC14E013C45E6F52AC00A0B5224F6876A1CA107DB" | jq .result.tx_result.log -r
  // and then replace \" with \\" to get the correct JavaScript escaping
  const rawLog =
    '[{"events":[{"type":"execute","attributes":[{"key":"_contract_address","value":"juno19pam0vncl2s3etn4e7rqxvpq2gkyu9wg2czfvsph6dgvp00fsrxqzjt5sr"},{"key":"_contract_address","value":"juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"}]},{"type":"message","attributes":[{"key":"action","value":"/cosmwasm.wasm.v1.MsgExecuteContract"},{"key":"module","value":"wasm"},{"key":"sender","value":"juno100s45s4h94qdkcafmmrqfltlrgyqwyn6e05jx2"}]},{"type":"send_packet","attributes":[{"key":"packet_channel_ordering","value":"ORDER_UNORDERED"},{"key":"packet_connection","value":"connection-31"},{"key":"packet_data","value":"{\\"after\\":\\"1666164035856871113\\",\\"sender\\":\\"juno19pam0vncl2s3etn4e7rqxvpq2gkyu9wg2czfvsph6dgvp00fsrxqzjt5sr\\",\\"job_id\\":\\"dapp-1-1666164017\\"}"},{"key":"packet_data_hex","value":"7b226166746572223a2231363636313634303335383536383731313133222c2273656e646572223a226a756e6f313970616d30766e636c32733365746e34653772717876707132676b797539776732637a66767370683664677670303066737278717a6a74357372222c226a6f625f6964223a22646170702d312d31363636313634303137227d"},{"key":"packet_dst_channel","value":"channel-10"},{"key":"packet_dst_port","value":"wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5"},{"key":"packet_sequence","value":"7489"},{"key":"packet_src_channel","value":"channel-42"},{"key":"packet_src_port","value":"wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"},{"key":"packet_timeout_height","value":"0-0"},{"key":"packet_timeout_timestamp","value":"1666167632856871113"}]},{"type":"wasm","attributes":[{"key":"_contract_address","value":"juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9"},{"key":"action","value":"execute_get_next_randomness"}]}]}]';
  const parsedLog = logs.parseRawLog(rawLog);

  const packets = parsePacketsFromLogs(parsedLog);
  t.is(packets.length, 1);
  t.deepEqual(packets[0], {
    sequence: Long.fromNumber(7489),
    sourcePort:
      'wasm.juno1e7vs76markshus39eyfefh2y3t9guge4t0kvqya3q6vamgsejh4q8lxtq9',
    sourceChannel: 'channel-42',
    destinationPort:
      'wasm.nois1j7m4f68lruceg5xq3gfkfdgdgz02vhvlq2p67vf9v3hwdydaat3sajzcy5',
    destinationChannel: 'channel-10',
    data: fromHex(
      '7b226166746572223a2231363636313634303335383536383731313133222c2273656e646572223a226a756e6f313970616d30766e636c32733365746e34653772717876707132676b797539776732637a66767370683664677670303066737278717a6a74357372222c226a6f625f6964223a22646170702d312d31363636313634303137227d'
    ),
    timeoutHeight: undefined,
    timeoutTimestamp: Long.fromString('1666167632856871113'),
  });
});

test('can parse revision numbers', (t) => {
  const musselnet = parseRevisionNumber('musselnet-4');
  t.is(musselnet.toNumber(), 4);

  const numerific = parseRevisionNumber('numers-123-456');
  t.is(numerific.toNumber(), 456);

  const nonums = parseRevisionNumber('hello');
  t.is(nonums.toNumber(), 0);

  const nonums2 = parseRevisionNumber('hello-world');
  t.is(nonums2.toNumber(), 0);
});

test('can parse strange revision numbers', (t) => {
  // all of these should give 0
  const strangers = [
    '',
    '-',
    'hello-',
    'hello-123-',
    'hello-0123',
    'hello-00123',
    'hello-1.23',
  ];
  for (const strange of strangers) {
    const rev = parseRevisionNumber(strange);
    t.is(rev.toNumber(), 0, strange);
  }
});

function nanosFromDateTime(time: ReadonlyDateWithNanoseconds): Long {
  const stamp = timestampFromDateNanos(time);
  return stamp.seconds.multiply(1_000_000_000).add(stamp.nanos);
}

test('time-based timeouts properly', (t) => {
  const time1 = fromRfc3339WithNanoseconds('2021-03-12T12:34:56.123456789Z');
  const time2 = fromRfc3339WithNanoseconds('2021-03-12T12:36:56.543543543Z');
  const time3 = fromRfc3339WithNanoseconds('2021-03-12T12:36:13Z');

  const sec1 = secondsFromDateNanos(time1);
  const nanos1 = nanosFromDateTime(time1);
  const sec2 = secondsFromDateNanos(time2);
  const nanos2 = nanosFromDateTime(time2);

  const greaterThanNull = timeGreater(undefined, secondsFromDateNanos(time1));
  t.is(greaterThanNull, true);

  const greaterThanPast = timeGreater(nanos2, sec1);
  t.is(greaterThanPast, true);
  const greaterThanFuture = timeGreater(nanos1, sec2);
  t.is(greaterThanFuture, false);

  // nanos seconds beat seconds if present
  const greaterThanSelfWithNanos = timeGreater(nanos1, sec1);
  t.is(greaterThanSelfWithNanos, true);
  const greaterThanSelf = timeGreater(
    nanosFromDateTime(time3),
    secondsFromDateNanos(time3)
  );
  t.is(greaterThanSelf, false);
});

test('height based timeouts properly', (t) => {
  const height1a = {
    revisionHeight: Long.fromNumber(12345),
    revisionNumber: Long.fromNumber(1),
  };
  const height1b = {
    revisionHeight: Long.fromNumber(14000),
    revisionNumber: Long.fromNumber(1),
  };
  const height2a = {
    revisionHeight: Long.fromNumber(600),
    revisionNumber: Long.fromNumber(2),
  };

  t.assert(heightGreater(height1b, height1a));
  t.assert(heightGreater(height2a, height1b));
  t.assert(heightGreater(undefined, height2a));

  t.false(heightGreater(height1b, height1b));
  t.false(heightGreater(height1a, height1b));
});

test('Properly determines height-based timeouts', (t) => {
  // proper heights
  t.deepEqual(parseHeightAttribute('1-34'), {
    revisionNumber: Long.fromNumber(1),
    revisionHeight: Long.fromNumber(34),
  });
  t.deepEqual(parseHeightAttribute('17-3456'), {
    revisionNumber: Long.fromNumber(17),
    revisionHeight: Long.fromNumber(3456),
  });

  // handles revision number 0 properly (this is allowed)
  t.deepEqual(parseHeightAttribute('0-1724'), {
    revisionNumber: Long.fromNumber(0),
    revisionHeight: Long.fromNumber(1724),
  });

  // missing heights
  t.is(parseHeightAttribute(''), undefined);
  t.is(parseHeightAttribute(), undefined);

  // bad format
  t.is(parseHeightAttribute('some-random-string'), undefined);

  // zero value is defined as missing
  t.is(parseHeightAttribute('0-0'), undefined);
});
