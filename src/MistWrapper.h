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

#include "nan.h"
#include "Mist.h"

class MistWrapper : public Nan::ObjectWrap {
public:

    static void Init(v8::Local<v8::Object> exports);
    
    void mistDeleted();

private:

    explicit MistWrapper(Mist* mist);

    ~MistWrapper();

    static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static void request(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static Nan::Persistent<v8::Function> constructor;

    Mist* _mist;
};

