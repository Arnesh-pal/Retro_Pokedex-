# 📺 CRT Pokédex

A retro-themed, fully responsive Pokédex application built with vanilla JavaScript and Node.js, designed to look and feel like an old CRT television. Browse, search, and view detailed information for over 1,000 Pokémon across all generations.

**Live Demo:** [**https://pokedex03.netlify.app**](https://pokedex03.netlify.app)

---

## 📸 Screenshots

| Desktop View | Mobile View |
| :---: | :---: |
| <img width="1414" alt="Desktop Screenshot" src="https://github.com/user-attachments/assets/f7c1bbba-ffaf-4895-ab2a-55d545a2aeea" /> | <img width="444" alt="Mobile Screenshot" src="https://github.com/user-attachments/assets/ecf9b3fc-8339-471e-afac-11208a23db80" /> |
| A full view of the Pokédex on a desktop, showcasing the CRT effect and Pokémon grid. | The vertically-oriented mobile layout, optimized for a handheld experience. |

---

## ✨ Features

* **Retro CRT TV Interface:** A unique and nostalgic design with scanlines, flicker, and glare effects.
* **Fully Responsive:** A seamless experience on desktop, tablet, and mobile devices with custom layouts for each.
* **Browse by Generation:** Filter the Pokédex to show Pokémon from any of the nine generations.
* **Live Search:** Instantly search for Pokémon by name or Pokédex number.
* **Detailed Pokémon Modal:** Click on any Pokémon to view a detailed pop-up with:
    * **About Tab:** Species, height, weight, and abilities.
    * **Stats Tab:** A visual breakdown of base stats (HP, Attack, Defense, etc.).
    * **Evolution Tab:** A dynamic, clickable evolution tree showing the entire family line.
    * **Moves Tab:** A comprehensive list of all learnable moves.
* **On-Demand Data Loading:** The backend is optimized to fetch data efficiently from the PokeAPI, ensuring fast load times and stable performance.

---

## 🛠️ Built With

This project is a full-stack application composed of a vanilla frontend and a Node.js backend.

**Frontend:**
* HTML5
* CSS3 with Tailwind CSS for utility classes
* Vanilla JavaScript (ES6+)

**Backend:**
* Node.js
* Express.js
* Axios (for making requests to the PokeAPI)
* CORS

**APIs & Services:**
* [PokeAPI](https://pokeapi.co/) - The source of all Pokémon data.

---

## 📜 License

Distributed under the **MIT License**.
See [`LICENSE`](./LICENSE) for more information.

---

## 🚀 Deployment

The application is deployed using a modern, decoupled approach:

* **Backend API:** Deployed as a **Web Service** on [**Render**](https://render.com/). Render automatically deploys new versions upon pushes to the `main` branch.
* **Frontend Application:** Deployed as a **Static Site** on [**Netlify**](https://www.netlify.com/). Netlify is connected to the same GitHub repository and deploys the `frontend` directory.

This architecture ensures high availability, scalability, and a clear separation of concerns between the client and server.

---

## ⚙️ Getting Started (Local Development)

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js and npm installed on your machine.
    ```sh
    npm install npm@latest -g
    ```

### Installation

1.  **Clone the repo**
    ```sh
    git clone [https://github.com/Arnesh-pal/Retro_Pokedex-.git]
    ```
2.  **Navigate to the backend and install dependencies**
    ```sh
    cd backend
    npm install
    ```
3.  **Start the backend server**
    * The server will run on `http://localhost:3001`.
    ```sh
    node server.js
    ```
4.  **Open the frontend**
    * In a new terminal, navigate to the `frontend` directory.
    * Open the `index.html` file in your browser (you can use a live server extension for the best experience). The frontend will automatically connect to your local backend server.

---

## 🙏 Acknowledgments

* A huge thank you to the team behind the [**PokeAPI**](https://pokeapi.co/) for providing such a comprehensive and free resource for Pokémon data.
* Fonts from [Google Fonts](https://fonts.google.com/).
