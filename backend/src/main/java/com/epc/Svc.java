package com.epc;
import org.springframework.messaging.simp.SimpMessagingTemplate; import org.springframework.stereotype.Service;

@Service class AuditService {
  private final AuditRepo repo; AuditService(AuditRepo r) { repo = r; }
  void log(String actor, String action, String target, String detail) {
    AuditLog a = new AuditLog(); a.actor = actor; a.action = action; a.target = target; a.detail = detail == null ? null : detail.substring(0, Math.min(detail.length(), 480)); repo.save(a);
  }
}
@Service class NoticeService {
  private final NoticeRepo repo; private final SimpMessagingTemplate ws; NoticeService(NoticeRepo r, SimpMessagingTemplate w) { repo = r; ws = w; }
  void send(String audience, String title, String body, String link) {
    if (audience == null) return;
    Notice n = new Notice(); n.audience = audience; n.title = title; n.link = link; n.body = body == null ? "" : body.substring(0, Math.min(body.length(), 480)); repo.save(n); ws.convertAndSend("/topic/notify", n);
  }
}
