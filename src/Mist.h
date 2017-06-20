#pragma once

#include "nan.h"
#include "Message.h"
#include "PCQueue.h"
#include <string>

class MistWrapper;

class Mist : public Nan::AsyncProgressWorker {
public:

    Mist(Nan::Callback *data);

    ~Mist();
    
    enum ApiType {
        ApiTypeMist = 2,
        ApiTypeMistNode = 3,
        ApiTypeWish = 4
    };
    
    void sendToNode(Message& message);
    
    void Execute(const Nan::AsyncProgressWorker::ExecutionProgress& progress);

    void HandleProgressCallback(const char *data, size_t size);
    
    void setWrapper(MistWrapper*);

    PCQueue<Message> fromNode;

    int apiType = ApiType::ApiTypeMist;
    std::string name = "Node";
    std::string coreIp = "127.0.0.1";
    int corePort = 9094;

private:
    bool run;
    const Nan::AsyncProgressWorker::ExecutionProgress* _progress;
    Nan::Callback *progress;
    PCQueue<Message> toNode;
    MistWrapper* mistWrapper;
};
