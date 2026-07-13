# ☕ Calcolatore Infusioni Caffè

Web app (PWA) per calcolare dosi, acqua e rapporti di estrazione per sei metodi di infusione: **Hario V60, AeroPress, Kalita 101, Hario Switch, moka e cold brew**.

## Funzionalità

- **Calcolo bidirezionale**: inserisci i grammi di caffè o di acqua e l'altro valore si aggiorna automaticamente in base al rapporto scelto
- **Rapporti corretti per metodo**: ogni tecnica ha il suo range (V60 1:14–1:17, moka 1:7–1:12, AeroPress 1:10–1:17, cold brew concentrato o pronto da bere)
- **Procedura passo-passo** con tempi e quantità ricalcolate in tempo reale: bloom, versate parziali, apertura valvola, diluizione
- **Preset rapidi**: tazze per i pour-over, taglie caldaia per la moka, volumi per il cold brew
- **Linee guida sull'acqua** secondo gli standard SCA: TDS, durezza, alcalinità, pH
- **Funziona offline** e salva le tue impostazioni sul dispositivo

## Installazione su smartphone

Apri l'app nel browser, poi:

- **Android (Chrome)**: menu ⋮ → *Aggiungi a schermata Home*
- **iPhone (Safari)**: Condividi → *Aggiungi a Home*

L'app si apre a schermo intero con la propria icona, anche senza connessione.

## Tecnologia

Un singolo file HTML senza dipendenze esterne, con manifest e service worker per l'installazione e l'uso offline. Nessun dato lascia il dispositivo: le impostazioni sono salvate in `localStorage`.

## Licenza

Uso libero. Buon caffè! ☕
