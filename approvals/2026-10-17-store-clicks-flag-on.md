# Count Visit-seller clicks
status: WAITING_ON_JON
red: second-look
project: Reset Biology
one_click: yes store clicks on

Turning on NEXT_PUBLIC_RB_STORE_CLICKS logs each Visit-seller click as a line in the server log. Nothing public changes and no collection is added. It needs a second look because it records visitor behavior and /privacy does not mention it. Built up to the line: PR #54, flag off. Also open: src/config/sellerLinks.ts has no real URLs, so every button is disabled and there is nothing to count yet. On yes: the local seat reads #54, merges, sets the flag. On no: no clicks are logged.
