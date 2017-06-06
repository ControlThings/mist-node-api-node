#pragma once

#include "nan.h"
#include "StreamingWorker.h"
#include "Message.h"
#include <string>

class Mist : public StreamingWorker {
public:

    Mist(Nan::Callback *data, v8::Local<v8::Object> & options);

    ~Mist();
    
    enum ApiType {
        ApiTypeMist = 2,
        ApiTypeMistNode = 3,
        ApiTypeWish = 4
    };
    
    void sendToNode(Message& message);

    void Execute(const Nan::AsyncProgressWorker::ExecutionProgress& progress);

    int apiType = ApiType::ApiTypeMist;
    std::string name = "Node";
    std::string coreIp = "127.0.0.1";
    int corePort = 9094;
    
private:
    bool run;
    const Nan::AsyncProgressWorker::ExecutionProgress* _progress;
};
