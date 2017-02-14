#pragma once

#include <nan.h>
#include "NativeExtension.h"
#include "Mist.h"

extern "C" {
    void mist_addon_start(Mist* mist);
    bool injectMessage(Mist* mist, int type, uint8_t* msg, int msg_len);
}

