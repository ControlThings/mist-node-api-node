#pragma once

#include <nan.h>
#include "NativeExtension.h"
#include "Mist.h"

extern "C" {
    void mist_addon_start(Mist* mist, char* name, int type, char* ip, uint16_t port);
    bool injectMessage(Mist* mist, int type, uint8_t* msg, int msg_len);
    void set_evenodd(void* instance);
}

