This script used to emulate MRBS system with multiple PanL70 emulator applications

                                                            /-----> [PanL70 emulator app] (1)
                                                            |-----> [PanL70 emulator app] (2)
                                                            |-----> [PanL70 emulator app] (3)
            [MRBS HUB]  <------>    [MRBS AGENT] <----------|-----> [PanL70 emulator app] (4)
                                                            |-----> [PanL70 emulator app] (5)
                                                            |-----> [PanL70 emulator app] (6)
                                                            |-----> [PanL70 emulator app] (7)
                                                            \-----> [PanL70 emulator app] (8)

In order to perform the emulator, do the steps below:

(1) Open configuration.json file and edit the directory which contains PanL70 emulator app, MRBS Agent, and MRBS Hub
    "panl70_emulator_app_dir":"D:\\MRBS_PanL70\\panl70\\MRBS_PanL_Display\\MRBS_PanL_Emulator\\Debug\\MRBS_PanL_Emulator.exe",
    "agent_app_dir"          :"D:\\MRBS_PanL70\\agent\\mrbsagent.exe",
    "mrbs_hub_dir"           :"D:\\MRBS_PanL70\\agent\\mrbshub_test.exe",

    Note: configuration.json file contains other configurations for PanL70 emulator app and MRBS Agent. User can edit if that is necessary

(2) Open Cygwin terminal and types command bellow:
    $ python Run_emulator.py