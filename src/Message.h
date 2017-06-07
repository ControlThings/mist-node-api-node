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
