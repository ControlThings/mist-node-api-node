/**
 * Copyright (C) 2020, ControlThings Oy Ab
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * @license Apache-2.0
 */
#pragma once

#include <string>

class Message {
public:
    std::string name;
    uint8_t* msg;
    int msg_len;

    Message(std::string name, uint8_t* m, int l);
    
    ~Message();
};
