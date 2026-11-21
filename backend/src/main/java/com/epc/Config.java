package com.epc;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
class WsConfig implements WebSocketMessageBrokerConfigurer {
  public void registerStompEndpoints(StompEndpointRegistry r) { r.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS(); }
  public void configureMessageBroker(MessageBrokerRegistry r) { r.enableSimpleBroker("/topic"); }
}

@Configuration
class WebConfig implements WebMvcConfigurer {
  public void addResourceHandlers(ResourceHandlerRegistry r) { r.addResourceHandler("/uploads/**").addResourceLocations("file:./uploads/"); }
}
