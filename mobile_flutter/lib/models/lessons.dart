// Types des parcours et des leçons (copie de types/index.ts : Path, Lesson).
//
// Le parcours s'appelle `LearningPath` : `Path` est déjà pris par dart:ui
// (tracés), exporté par package:flutter/material.dart.

/// Parcours d'apprentissage, tel que renvoyé par `GET /api/paths`.
class LearningPath {
  final String id;
  final String title;
  final String description;
  final num progress;
  final int totalLessons;
  final int completedLessons;
  final bool isLocked;

  /// Parcours annoncé mais pas encore de leçons.
  final bool comingSoon;
  final String color;
  final String emoji;

  const LearningPath({
    required this.id,
    required this.title,
    this.description = '',
    this.progress = 0,
    this.totalLessons = 0,
    this.completedLessons = 0,
    this.isLocked = false,
    this.comingSoon = false,
    this.color = '',
    this.emoji = '',
  });

  factory LearningPath.fromJson(Map json) => LearningPath(
        id: '${json['id'] ?? ''}',
        title: '${json['title'] ?? ''}',
        description: '${json['description'] ?? ''}',
        progress: json['progress'] is num ? json['progress'] as num : 0,
        totalLessons: _int(json['totalLessons']),
        completedLessons: _int(json['completedLessons']),
        isLocked: json['isLocked'] == true,
        comingSoon: json['comingSoon'] == true,
        color: '${json['color'] ?? ''}',
        emoji: '${json['emoji'] ?? ''}',
      );

  /// Accepte une instance ou la Map JSON de l'API (paramètre de navigation).
  static LearningPath from(Object? value) {
    if (value is LearningPath) return value;
    if (value is Map) return LearningPath.fromJson(value);
    return const LearningPath(id: '', title: '');
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'progress': progress,
        'totalLessons': totalLessons,
        'completedLessons': completedLessons,
        'isLocked': isLocked,
        'comingSoon': comingSoon,
        'color': color,
        'emoji': emoji,
      };
}

/// Leçon d'un parcours, telle que renvoyée par `GET /api/lessons/<pathId>`.
class Lesson {
  final String id;
  final String title;

  /// 'lesson' | 'review' | 'test'
  final String type;

  /// 'locked' | 'available' | 'completed'
  final String status;
  final int stars;

  /// 'left' | 'center' | 'right'
  final String position;
  final int? xp;

  const Lesson({
    required this.id,
    required this.title,
    this.type = 'lesson',
    this.status = 'locked',
    this.stars = 0,
    this.position = 'center',
    this.xp,
  });

  factory Lesson.fromJson(Map json) => Lesson(
        id: '${json['id'] ?? ''}',
        title: '${json['title'] ?? ''}',
        type: '${json['type'] ?? 'lesson'}',
        status: '${json['status'] ?? 'locked'}',
        stars: _int(json['stars']),
        position: '${json['position'] ?? 'center'}',
        xp: json['xp'] is num ? (json['xp'] as num).toInt() : null,
      );

  /// Accepte une instance ou la Map JSON de l'API (paramètre de navigation).
  static Lesson from(Object? value) {
    if (value is Lesson) return value;
    if (value is Map) return Lesson.fromJson(value);
    return const Lesson(id: '', title: '');
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'type': type,
        'status': status,
        'stars': stars,
        'position': position,
        if (xp != null) 'xp': xp,
      };
}

int _int(Object? v) => v is num ? v.toInt() : 0;
