# AppCel — treinos com GPS e relógio Bluetooth

App Android (React Native + Expo) que:

- **Grava o percurso pelo GPS**, inclusive com a tela apagada, e mostra no mapa (OpenStreetMap). Calcula distância, tempo, ritmo e subida acumulada.
- **Conecta ao relógio por Bluetooth** e registra a frequência cardíaca ao vivo durante o treino, usando o perfil padrão Heart Rate (0x180D).
- **Guarda tudo no celular** (SQLite) e **sincroniza com o Firebase** (Firestore) para análise posterior.
- Mostra o **histórico** com mapa, FC média e máxima, zonas de FC e exportação em GPX (aceito por Strava e Google Earth).

## Relógio Amazfit Stratos

A frequência cardíaca ao vivo funciona quando o relógio a **transmite no padrão Bluetooth**. No Stratos, procure em
*Configurações* a opção de compartilhar ou transmitir a frequência cardíaca ("Heart rate sharing"). Se ela não existir no
seu modelo, a aba **Relógio** mostra os serviços Bluetooth que o relógio expõe; com essa lista dá pra avaliar outro caminho.

Passos, sono e o histórico do relógio não saem por Bluetooth para apps de terceiros. Eles vêm pelo app Zepp → Health
Connect. Essa integração é a próxima etapa.

## Instalar no celular (sem computador)

1. No GitHub, abra **Actions → Build APK Android** e entre na execução mais recente que estiver verde.
2. Baixe o artefato **AppCel-apk** (um .zip com o `app-release.apk`).
3. Abra o .apk no celular e permita "instalar apps desconhecidos".
4. Na primeira vez, aceite localização **"Permitir o tempo todo"**, Bluetooth / dispositivos por perto e notificações.

## Configurar o Firebase (banco de dados)

1. Crie um projeto em <https://console.firebase.google.com>.
2. Em **Authentication → Método de login**, ative **E-mail/senha**.
3. Em **Firestore Database**, crie o banco (região `southamerica-east1`) e cole em **Regras** o conteúdo de `firestore.rules`.
4. Em **Configurações do projeto → Seus apps**, adicione um app **Web** e copie a configuração.
5. No GitHub, abra **Settings → Secrets and variables → Actions → Variables** e crie `FIREBASE_API_KEY`,
   `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID` e `FIREBASE_APP_ID`.
   Para desenvolvimento local, use o `.env` (copie de `.env.example`).
6. Rode o workflow de novo para gerar um APK já conectado. No app, crie sua conta na aba **Conta**.

### Estrutura dos dados no Firestore

```
users/{uid}/workouts/{workoutId}
  started_at, ended_at, distance_m, duration_s, avg_hr, max_hr, device_name, point_count, hr_count
users/{uid}/workouts/{workoutId}/route/{0000,0001…}       { points: [{ts, lat, lon, alt, speed, acc}] }
users/{uid}/workouts/{workoutId}/heart_rate/{0000,0001…}  { samples: [{ts, bpm}] }
```

Para analisar no Python, Sheets ou BigQuery, você pode exportar pelo console do Firebase ou usar a extensão
"Stream Firestore to BigQuery".

## Desenvolvimento

```bash
npm install
cp .env.example .env      # preencha
npx expo run:android      # celular conectado por USB, com Android Studio/SDK instalados
npx tsc --noEmit          # checagem de tipos
```

O app usa módulos nativos (Bluetooth, GPS em segundo plano), então **não roda no Expo Go**. É preciso o APK ou um
development build.

## Estrutura

```
App.tsx                      abas: Treino · Relógio · Histórico · Conta
src/locationTask.ts          tarefa de GPS em segundo plano (registrada em index.ts)
src/ble.ts                   Bluetooth: busca, conexão, leitura de FC (0x2A37) e bateria
src/db.ts                    SQLite local (treinos, pontos GPS, amostras de FC)
src/sync.ts                  envio para o Firestore
src/RouteMap.tsx             mapa Leaflet/OpenStreetMap em WebView
src/screens/*                telas
```

## Próximas etapas

- [ ] Health Connect: passos, sono, SpO2 e treinos do app Zepp
- [ ] FC máxima configurável para as zonas de treino
- [ ] Gráficos de tendência semanal e mensal
- [ ] Pausa automática
