#pragma once

#include <cstddef>

class Test {
public:
    static void send(uint8_t* buf, int len);
    static void write(uint8_t* buf, int len);
    static void invoke(uint8_t* buf, int len);
    static void kill();
};

