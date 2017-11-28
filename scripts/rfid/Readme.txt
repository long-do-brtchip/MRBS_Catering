This script used to send RFID code to Agent.

RUN:
    $ python panl70_rfid.py [-p port_addr] [-i ip_addr] [-m agent_mac] [-d panl_mac] [-c rfid_code]

        -h: show this help message and exit
        -p: MRBS Agent Port address             Example: -p 9999
        -i: MRBS Agent IP address               Example: -i 192.168.1.1
        -m: MRBS Agent MAC address              Example: -m 16
        -d: PanL70 MAC                          Example: -d 16
        -c: RFID ID data                        Example: -c 1234567890
        -n: Run with default configration

NOTE: Run script without option or '-n' will run with default data
For example: $ python panl70_rfid.py -p 9999 -i 192.168.1.1 -d 16 -m 16 -c 1234567890a
			 $ python panl70_rfid.py -c 1234567890a