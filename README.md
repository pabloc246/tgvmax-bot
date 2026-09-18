<div align="center">
    <img src="./logo.jpg" width="200">
</div>

---------------------------------------

# Qu'est-ce que c'est ?

[TGVMax bot](https://github.com/Eywek/tgvmax-bot) est un [bot](https://fr.wikipedia.org/wiki/Bot_informatique) qui a pour but de permettre la réservation facilement et automatiquement de billet [TGVMax](https://www.tgvmax.fr/VSC/fr-FR).

Ce fork est un **bloc unique** : pas de frontend web, pas de serveur HTTP, pas de reverse-proxy. Tout tourne dans un seul process Node, piloté par une interface en ligne de commande (TUI).

Il est recommandé d'avoir des connaissances techniques de base (Docker/containers) pour pouvoir installer le bot.

# Fonctionnalités

- Recherche et réservation immédiate de billets TGVMax via le menu interactif (sans avoir à passer par sncf-connect ou trainline)
- Alertes avec possibilité de réservation automatique
    - Un compte [Trainline Business](https://www.trainline.fr/business) est requis pour la réservation automatique
    - Vous pouvez configurer des alertes et être alerté via SMS (si vous êtes chez Free) ou via Telegram
- Alertes récurrentes (voir [cron](https://fr.wikipedia.org/wiki/Cron#Syntaxe_de_la_table))
    - Exemple: ajouter automatiquement des alertes et réserver automatiquement tous les trains le mardi entre 10h et 11h

La veille des alertes (recherche périodique + notification + réservation) tourne en tâche de fond dans le même process, indépendamment du menu : elle démarre dès que le container démarre et continue tant qu'il tourne, que vous soyez en train de naviguer dans le menu ou non.

# Installation

Une seule image [Docker](https://www.docker.com) ([liste](https://github.com/Eywek?tab=packages&repo_name=tgvmax-bot)) à lancer, **en mode interactif** (`-it`) puisque le menu se pilote au clavier :

```bash
docker run -it --restart=on-failure --name tgvmax-bot -v <path to sqlite>/tgvmax.sqlite:/usr/src/tgvmax.sqlite ghcr.io/<votre-fork>-bot:<tag>
```

_**Note:** Le bot utilise SQLite comme base de données, il est donc recommandé de créer un fichier vide appelé `tgvmax.sqlite` et de le fournir comme volume au container, pour pouvoir garder la configuration au cours des mises à jour._

Si vous voulez pouvoir fermer votre terminal sans arrêter la veille des alertes (le process continue de tourner tant que le container vit), démarrez-le détaché puis reconnectez-vous au menu quand vous en avez besoin :

```bash
docker run -dit --restart=on-failure --name tgvmax-bot -v <path to sqlite>/tgvmax.sqlite:/usr/src/tgvmax.sqlite ghcr.io/<votre-fork>-bot:<tag>
docker attach tgvmax-bot   # pour ouvrir le menu ; Ctrl+P Ctrl+Q pour vous détacher sans quitter le bot
```

## Variables d'environnement

| Variable | Description | Défaut |
|---|---|---|
| `SQLITE_FILE` | Chemin du fichier SQLite | `tgvmax.sqlite` |
| `DATABASE` | `sqlite` ou `postgres` | `sqlite` |
| `TELEGRAM_TOKEN` | Token du bot Telegram (optionnel, pour les notifications Telegram) | — |

## Sans Docker

```bash
npm ci
npm run generate   # télécharge la liste des gares
npm start          # lance le bot + le menu
```
