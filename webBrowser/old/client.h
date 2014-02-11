#ifndef _CLIENT_H
#define _CLIENT_H

#include <string>
#include <boost/asio.hpp>

class Client {

    private:
        boost::asio::ip::tcp::socket mSocket;
        boost::asio::ip::tcp::resolver::iterator mResolver;
        std::string mServer;
        std::string mPort;

    public:
        Client(boost::asio::io_service& io_service, const std::string& server, const std::string& port);
        void connect();
};
#endif
