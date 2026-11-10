# Orbit Voice — Kit de branchement ElevenLabs (Hôtel)

Assistant vocal IA « réceptionniste » pour Orbit Hôtel. La plateforme (ElevenLabs
Conversational AI + Twilio) gère l'appel et la voix ; OrbitAll expose des **tools**
HTTP sécurisés que l'agent appelle pour agir sur la base.

> **Human-in-the-loop** : l'agent crée les réservations en statut **`option`**.
> Il ne confirme jamais seul — le staff valide depuis `/hotel/reservations`.

---

## 0. Pré-requis (côté OrbitAll)

1. **Jouer la migration `044_voice_ai.sql`** dans Supabase.
2. Définir la variable d'environnement :
   ```
   VOICE_AI_TOOL_SECRET="<openssl rand -base64 32>"
   ```
3. **Déployer** (les endpoints doivent être joignables depuis Internet). En local,
   utiliser un tunnel type `ngrok http 3000` → URL publique `https://xxxx.ngrok.app`.
4. Dans **Réglages Hôtel** (`/hotel/reglages`), renseigner le **numéro de l'assistant**
   au format international (ex. `+33123456789`). Cela crée la ligne `voice_numbers`
   qui rattache le numéro à l'établissement.
5. Avoir au moins **1 type de chambre**, **1 plan tarifaire** et **des chambres**
   (Inventaire + Tarifs) sinon l'IA n'a rien à vendre.

Base URL des tools : `https://TON_DOMAINE/api/voice/hotel`

---

## 1. Les 3 tools (config ElevenLabs → « Server tools »)

Pour chaque tool : **Method** = `POST`, **Header** `Authorization: Bearer {{VOICE_AI_TOOL_SECRET}}`
(ajouter le secret dans les *secrets* de l'agent, puis le sélectionner dans le header du tool).

> **Numéro appelé** : ajouter dans le body le champ `called_number` mappé sur la
> variable dynamique du numéro appelé (ElevenLabs expose le numéro entrant en
> variable système — vérifier son nom exact, ex. `{{system__called_number}}`).
> Nos endpoints acceptent `called_number`, `to` ou `phone` — l'un des trois suffit.

### Tool 1 — `check_availability`
- **URL** : `.../availability`
- **Description** : « Vérifie les chambres disponibles et leur prix pour une plage de dates. »
- **Body (JSON schema)** :
```json
{
  "type": "object",
  "properties": {
    "called_number": { "type": "string", "description": "Numéro appelé (variable système)" },
    "check_in":  { "type": "string", "description": "Date d'arrivée AAAA-MM-JJ" },
    "check_out": { "type": "string", "description": "Date de départ AAAA-MM-JJ" }
  },
  "required": ["check_in", "check_out"]
}
```
- **Réponse** : `{ room_types: [{ code, name, available_rooms, price_per_night_eur }], nights }`

### Tool 2 — `create_reservation`
- **URL** : `.../reserve`
- **Description** : « Enregistre une réservation en attente de confirmation par la réception. Utiliser UNIQUEMENT après accord explicite du client. »
- **Body (JSON schema)** :
```json
{
  "type": "object",
  "properties": {
    "called_number":  { "type": "string" },
    "customer_name":  { "type": "string" },
    "customer_email": { "type": "string" },
    "check_in":  { "type": "string", "description": "AAAA-MM-JJ" },
    "check_out": { "type": "string", "description": "AAAA-MM-JJ" },
    "adults":    { "type": "number" },
    "children":  { "type": "number" },
    "rooms": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "room_type_code": { "type": "string", "description": "Code du type (ex. DBL)" },
          "rate_plan_code": { "type": "string", "description": "Code tarif (optionnel)" },
          "guest_name":     { "type": "string" },
          "occupants":      { "type": "number" }
        },
        "required": ["room_type_code"]
      }
    }
  },
  "required": ["check_in", "check_out", "adults", "rooms"]
}
```
- **Réponse** : `{ ok, reference, status: "option", message }`

### Tool 3 — `get_reservation`
- **URL** : `.../reservation`
- **Description** : « Donne l'état d'une réservation à partir de sa référence (ex. R-2026-0001). »
- **Body (JSON schema)** :
```json
{
  "type": "object",
  "properties": {
    "called_number": { "type": "string" },
    "reference":     { "type": "string" }
  },
  "required": ["reference"]
}
```
- **Réponse** : `{ reference, status, check_in, check_out, total_eur, balance_eur }`

---

## 2. Prompt système de l'agent (FR, hôtel de luxe)

```
Tu es l'assistant vocal de la réception d'un hôtel de luxe. Tu réponds au
téléphone avec chaleur, courtoisie et concision, dans un français impeccable.

RÔLE
- Accueillir, comprendre le besoin (renseignement, réservation, suivi de dossier),
  et y répondre en t'appuyant sur les outils à ta disposition.
- Tu parles au nom de l'établissement, jamais « en tant qu'IA » de façon insistante,
  mais tu ne mens pas : si on te le demande, tu confirmes être un assistant.

RÉSERVATION (règle absolue)
- Recueille : dates d'arrivée et de départ, nombre d'adultes/enfants, type de chambre.
- Appelle `check_availability` pour proposer les chambres réellement disponibles et
  leurs prix. Ne propose jamais une chambre que l'outil ne renvoie pas.
- Après accord EXPLICITE du client, appelle `create_reservation`.
- IMPORTANT : cet outil crée une réservation « en option ». Tu annonces qu'elle est
  « enregistrée et en attente de confirmation par la réception », et que le client
  sera recontacté / recevra une confirmation. Tu ne dis JAMAIS qu'elle est
  définitivement confirmée. Tu ne fixes jamais un numéro de chambre toi-même.
- Communique la référence (ex. R-2026-0001) au client.

SUIVI
- Pour l'état d'un dossier, demande la référence et utilise `get_reservation`.

STYLE
- Phrases courtes, naturelles, une question à la fois. Reformule les dates pour
  confirmer. Reste patient. En cas de demande hors de ta portée (réclamation
  complexe, demande sensible), propose de transférer à un collègue humain.
- Ne divulgue jamais d'informations internes (autres clients, données système).
```

**Premier message** :
```
Bonjour et bienvenue à l'Hôtel [Nom]. Je suis votre assistant. Comment puis-je vous aider ?
```

Voix : choisir une voix ElevenLabs française premium. Langue : Français.

---

## 3. Tester les endpoints (avant même de brancher la voix)

Remplace `SECRET`, `URL` et `+33…` par les tiens (le numéro doit exister dans
`voice_numbers` via les Réglages Hôtel).

```bash
# Disponibilité
curl -s -X POST "$URL/api/voice/hotel/availability" \
  -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
  -d '{"called_number":"+33123456789","check_in":"2026-08-01","check_out":"2026-08-03"}' | jq

# Réservation (crée un dossier en statut "option")
curl -s -X POST "$URL/api/voice/hotel/reserve" \
  -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
  -d '{"called_number":"+33123456789","customer_name":"Jean Dupont","check_in":"2026-08-01","check_out":"2026-08-03","adults":2,"rooms":[{"room_type_code":"DBL"}]}' | jq

# Suivi
curl -s -X POST "$URL/api/voice/hotel/reservation" \
  -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
  -d '{"called_number":"+33123456789","reference":"R-2026-0001"}' | jq
```

Sécurité : sans le bon `Authorization: Bearer`, tout renvoie `401`. Un `called_number`
non rattaché renvoie `404`. L'organisation est toujours dérivée du numéro appelé,
jamais du corps.

---

## 4. Validation humaine

Les réservations créées par l'IA apparaissent dans `/hotel/reservations` avec le
statut **« Option »**. Le staff ouvre la fiche → **Confirmer** (option → confirmed) →
**assigne une chambre** (la garde anti-surbooking s'active) → check-in le jour venu.
