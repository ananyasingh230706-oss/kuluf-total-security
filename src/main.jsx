import React, {
  useEffect,
  useState,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import "./styles.css";

/* =========================================================
   KULUF TOTAL SECURITY
   MAIN APPLICATION
   ========================================================= */

/* =========================================================
   API
   ========================================================= */
const API_BASE_URL = "https://kuluf-total-security.onrender.com";

const api = async (
  url,
  options = {}
) => {
  const token =
    localStorage.getItem(
      "kuluf_token"
    );

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  if (
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  const response = await fetch(
  url.startsWith("http")
    ? url
    : `${API_BASE_URL}${url}`,
  {
    ...options,
    headers,
  }
);

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        "Something went wrong"
    );
  }

  return data;
};

/* =========================================================
   HELPERS
   ========================================================= */

const money = (value) =>
  `₹${Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  )}`;

const cartCount = (
  cart
) =>
  cart?.items?.reduce(
    (
      total,
      item
    ) =>
      total +
      Number(
        item.quantity || 0
      ),
    0
  ) || 0;

const lines = (
  value,
  fallback = ""
) =>
  String(
    value || fallback
  )
    .replace(
      /\\n/g,
      "\n"
    )
    .split("\n")
    .filter(Boolean);

/* =========================================================
   APP
   ========================================================= */

function App() {
  const [
    route,
    setRoute,
  ] = useState(
    window.location.pathname
  );

  const [
    user,
    setUser,
  ] = useState(null);

  const [
    cart,
    setCart,
  ] = useState({
    items: [],
  });

  const [
    toast,
    setToast,
  ] = useState("");

  /* -------------------------------------------------------
     NAVIGATION
     ------------------------------------------------------- */

  const navigate = (
    path
  ) => {
    if (!path) return;

    window.history.pushState(
      {},
      "",
      path
    );

    setRoute(path);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* -------------------------------------------------------
     TOAST
     ------------------------------------------------------- */

  const notify = (
    message
  ) => {
    setToast(message);

    setTimeout(
      () => setToast(""),
      2500
    );
  };

  /* -------------------------------------------------------
     CART
     ------------------------------------------------------- */

  const loadCart =
    async () => {
      try {
        const data =
          await api(
            "/api/cart"
          );

        setCart(data);
      } catch {
        setCart({
          items: [],
        });
      }
    };

  useEffect(() => {
    const handlePop =
      () => {
        setRoute(
          window.location.pathname
        );
      };

    window.addEventListener(
      "popstate",
      handlePop
    );

    api(
      "/api/auth/me"
    )
      .then(setUser)
      .catch(
        () => setUser(null)
      );

    loadCart();

    return () =>
      window.removeEventListener(
        "popstate",
        handlePop
      );
  }, []);

  /* -------------------------------------------------------
     ADD TO CART
     ------------------------------------------------------- */

  const addToCart =
    async (
      productId
    ) => {
      try {
        await api(
          "/api/cart/items",
          {
            method: "POST",
            body:
              JSON.stringify({
                productId,
                quantity: 1,
              }),
          }
        );

        await loadCart();

        notify(
          "Added to cart"
        );
      } catch (
        error
      ) {
        notify(
          error.message
        );
      }
    };

  /* -------------------------------------------------------
     ROUTING
     ------------------------------------------------------- */

  if (
    route.startsWith(
      "/admin"
    )
  ) {
    return (
      <Admin
        user={user}
        setUser={setUser}
        navigate={navigate}
      />
    );
  }

  let page;

  if (
    route === "/"
  ) {
    page = (
      <Home
        add={addToCart}
        navigate={navigate}
      />
    );
  } else if (
    route === "/about"
  ) {
    page = (
      <About
        navigate={navigate}
      />
    );
  } else if (
    route === "/shop" ||
    route.startsWith(
      "/shop?"
    )
  ) {
    page = (
      <Shop
        add={addToCart}
        navigate={navigate}
      />
    );
  } else if (
    route.startsWith(
      "/product/"
    )
  ) {
    page = (
      <Product
        slug={route.replace(
          "/product/",
          ""
        )}
        add={addToCart}
        navigate={navigate}
      />
    );
  } else if (
    route === "/cart"
  ) {
    page = (
      <Cart
        cart={cart}
        reload={loadCart}
        navigate={navigate}
      />
    );
  } else if (
    route === "/checkout"
  ) {
    page = (
      <Checkout
        cart={cart}
        navigate={navigate}
      />
    );
  } else if (
    route === "/login"
  ) {
    page = (
      <Login
        setUser={setUser}
        navigate={navigate}
      />
    );
  } else if (
    route === "/account"
  ) {
    page = (
      <Account
        user={user}
        navigate={navigate}
      />
    );
  } else if (
    route === "/orders"
  ) {
    page = (
      <Orders
        user={user}
        navigate={navigate}
      />
    );
  } else if (
    route === "/contact"
  ) {
    page = <Contact />;
  } else if (
    route === "/faq"
  ) {
    page = <FAQ />;
  } else {
    page = (
      <NotFound
        navigate={navigate}
      />
    );
  }

  return (
    <>
      <Header
        user={user}
        cart={cart}
        navigate={navigate}
      />

      <main>
        {page}
      </main>

      <Footer
        navigate={navigate}
      />

      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </>
  );
}

/* =========================================================
   HEADER
   ========================================================= */

function Header({
  user,
  cart,
  navigate,
}) {
  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const links = [
    ["Home", "/"],
    ["About", "/about"],
    ["Products", "/shop"],
    [
      "Security Locks",
      "/shop",
    ],
    [
      "Services",
      "/contact",
    ],
    [
      "Solutions",
      "/contact",
    ],
  ];

  const go = (
    event,
    path
  ) => {
    event.preventDefault();

    setMobileOpen(false);

    navigate(path);
  };

  return (
    <>
      <div className="topbar">
        <div>
          LOGISTICS{" "}
          <b>|</b>{" "}
          LOCKS{" "}
          <b>|</b>{" "}
          SAFER WORLD
        </div>

        <span>
          Trusted by Homes,
          Businesses &
          Industries
          &nbsp; | &nbsp;
          Support
          &nbsp; | &nbsp;
          Track Order
        </span>
      </div>

      <header>
        <a
          className="logo"
          href="/"
          onClick={(e) =>
            go(e, "/")
          }
        >
          KULUF

          <small>
            TOTAL SECURITY
          </small>
        </a>

        <nav>
          {links.map(
            ([
              label,
              path,
            ]) => (
              <a
                key={label}
                href={path}
                onClick={(
                  e
                ) =>
                  go(
                    e,
                    path
                  )
                }
              >
                {label}
              </a>
            )
          )}
        </nav>

        <div className="head-actions">

          <a
            href="/shop"
            onClick={(e) =>
              go(
                e,
                "/shop"
              )
            }
          >
            ⌕
          </a>

          <a
            href={
              user
                ? "/account"
                : "/login"
            }
            onClick={(e) =>
              go(
                e,
                user
                  ? "/account"
                  : "/login"
              )
            }
          >
            ♙
          </a>

          <a
            href="/cart"
            onClick={(e) =>
              go(
                e,
                "/cart"
              )
            }
          >
            🛒

            {cartCount(
              cart
            ) >
              0 && (
              <sup>
                {cartCount(
                  cart
                )}
              </sup>
            )}
          </a>

          <button
            onClick={() =>
              navigate(
                "/contact"
              )
            }
          >
            GET A QUOTE →
          </button>

        </div>

        <button
          className="mobile-menu"
          type="button"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="kuluf-mobile-navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
        </button>
      </header>

      {mobileOpen && (
        <div
          className="mobile-nav"
          id="kuluf-mobile-navigation"
        >
          <div className="mobile-nav-links">
            {links.map(([label, path]) => (
              <a
                key={label}
                href={path}
                onClick={(e) => go(e, path)}
              >
                {label}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>

          <div className="mobile-nav-actions">
            <a
              href={user ? "/account" : "/login"}
              onClick={(e) => go(e, user ? "/account" : "/login")}
            >
              {user ? "My Account" : "Sign In"}
            </a>
            <a
              href="/cart"
              onClick={(e) => go(e, "/cart")}
            >
              Cart <span className="mobile-cart-count">{cartCount(cart)}</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                navigate("/contact");
              }}
            >
              Get a quote <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   HERO
   ========================================================= */

function Hero({
  title,
  description,
  image,
  label,
  primaryText,
  primaryLink,
  secondaryText,
  secondaryLink,
  imagePosition,
  overlay,
  navigate,
}) {
  const heading =
    title ||
    "SECURITY\\nSTARTS AT\\nYOUR DOOR.";

  const heroImage =
    image ||
    "/uploads/hero-lock.svg";

  const opacity =
    Math.min(
      0.98,
      Math.max(
        0.35,
        Number(
          overlay ??
            0.78
        )
      )
    );

  return (
    <section
      className="hero"
      style={{
        backgroundImage: `
          linear-gradient(
            90deg,
            rgba(3,8,7,.98),
            rgba(3,8,7,${opacity}) 46%,
            rgba(0,0,0,.12)
          ),
          url("${heroImage}")
        `,
        backgroundPosition:
          imagePosition ||
          "center",
      }}
    >
      <div className="hero-copy">

        <label>
          {label ||
            "× KULUF TOTAL SECURITY"}
        </label>

        <h1>
          {lines(
            heading
          ).map(
            (
              line,
              index
            ) => (
              <React.Fragment
                key={
                  index
                }
              >
                {index >
                  0 && (
                  <br />
                )}

                <span
                  className={
                    index ===
                    2
                      ? "gold"
                      : ""
                  }
                >
                  {line}
                </span>
              </React.Fragment>
            )
          )}
        </h1>

        {description && (
          <p>
            {description}
          </p>
        )}

        <div>

          <button
            onClick={() =>
              navigate(
                primaryLink ||
                  "/shop"
              )
            }
          >
            {primaryText ||
              "EXPLORE LOCKS →"}
          </button>

          <button
            className="outline"
            onClick={() =>
              navigate(
                secondaryLink ||
                  "/contact"
              )
            }
          >
            {secondaryText ||
              "GET A QUOTE →"}
          </button>

        </div>

      </div>
    </section>
  );
}

/* =========================================================
   LIFESTYLE CAROUSEL
   ========================================================= */

function LifestyleCarousel({ navigate, content = {} }) {
  const slides = [
    {
      image:
        content.carousel_1_image || "/uploads/lifestyle.svg",
      eyebrow:
        content.carousel_1_eyebrow || "KULUF LIFESTYLE",
      title:
        content.carousel_1_title || "ELEGANT SECURITY",
      highlight:
        content.carousel_1_highlight || "FOR MODERN SPACES.",
      description:
        content.carousel_1_description ||
        "Designed to blend seamlessly with your home or office.",
      button:
        content.carousel_1_button || "EXPLORE COLLECTION →",
      link: content.carousel_1_link || "/shop",
    },
    {
      image:
        content.carousel_2_image || "/uploads/hero-lock.svg",
      eyebrow:
        content.carousel_2_eyebrow || "SMART SECURITY",
      title:
        content.carousel_2_title || "SECURITY THAT",
      highlight:
        content.carousel_2_highlight || "BELONGS IN YOUR SPACE.",
      description:
        content.carousel_2_description ||
        "Advanced access technology with a premium architectural aesthetic.",
      button:
        content.carousel_2_button || "EXPLORE LOCKS →",
      link: content.carousel_2_link || "/shop",
    },
    {
      image:
        content.carousel_3_image || "/uploads/about-hero.svg",
      eyebrow:
        content.carousel_3_eyebrow || "THE KULUF DIFFERENCE",
      title:
        content.carousel_3_title || "MORE THAN A LOCK.",
      highlight:
        content.carousel_3_highlight || "IT'S INTELLIGENCE.",
      description:
        content.carousel_3_description ||
        "Modern security designed around the way you live and work.",
      button:
        content.carousel_3_button || "DISCOVER KULUF →",
      link: content.carousel_3_link || "/about",
    },
  ];

  const [activeSlide, setActiveSlide] = useState(0);

  const nextSlide = () => {
    setActiveSlide((current) =>
      current === slides.length - 1 ? 0 : current + 1
    );
  };

  const previousSlide = () => {
    setActiveSlide((current) =>
      current === 0 ? slides.length - 1 : current - 1
    );
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((current) =>
        current === slides.length - 1 ? 0 : current + 1
      );
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="lifestyle-carousel">
      <div className="lifestyle-carousel-stage">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`lifestyle-carousel-slide ${
              index === activeSlide ? "active" : ""
            }`}
            style={{
              backgroundImage: `
                linear-gradient(
                  90deg,
                  rgba(3,8,7,.96) 0%,
                  rgba(3,8,7,.78) 38%,
                  rgba(3,8,7,.30) 70%,
                  rgba(0,0,0,.08) 100%
                ),
                url("${slide.image}")
              `,
            }}
          >
            <div className="lifestyle-carousel-content">
              <div className="eyebrow">{slide.eyebrow}</div>

              <h2>
                {slide.title}
                <br />
                <span>{slide.highlight}</span>
              </h2>

              <p>{slide.description}</p>

              <button onClick={() => navigate(slide.link)}>
                {slide.button}
              </button>
            </div>
          </div>
        ))}

        <button
          className="lifestyle-carousel-arrow lifestyle-carousel-prev"
          onClick={previousSlide}
          aria-label="Previous slide"
        >
          ←
        </button>

        <button
          className="lifestyle-carousel-arrow lifestyle-carousel-next"
          onClick={nextSlide}
          aria-label="Next slide"
        >
          →
        </button>

        <div className="lifestyle-carousel-navigation">
          <div className="lifestyle-carousel-counter">
            <span className="current">
              {String(activeSlide + 1).padStart(2, "0")}
            </span>
            <span className="separator">/</span>
            <span>{String(slides.length).padStart(2, "0")}</span>
          </div>

          <div className="lifestyle-carousel-dots">
            {slides.map((slide, index) => (
              <button
                key={index}
                className={index === activeSlide ? "active" : ""}
                onClick={() => setActiveSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


/* =========================================================
   HOME
   ========================================================= */

function Home({
  add,
  navigate,
}) {
  const [
    data,
    setData,
  ] = useState({
    products: [],
    cats: [],
    content: {},
  });

  useEffect(() => {
    Promise.all([
      api(
        "/api/products"
      ),
      api(
        "/api/categories"
      ),
      api(
        "/api/content"
      ),
    ])
      .then(
        ([
          products,
          cats,
          content,
        ]) =>
          setData({
            products,
            cats,
            content,
          })
      )
      .catch(
        console.error
      );
  }, []);

  const c =
    data.content;

  return (
    <>
      <Hero
        title={
          c.hero_title
        }
        description={
          c.hero_description
        }
        image={
          c.hero_image
        }
        label={
          c.hero_label
        }
        primaryText={
          c.hero_primary_text
        }
        primaryLink={
          c.hero_primary_link
        }
        secondaryText={
          c.hero_secondary_text
        }
        secondaryLink={
          c.hero_secondary_link
        }
        imagePosition={
          c.hero_image_position
        }
        overlay={
          c.hero_overlay
        }
        navigate={
          navigate
        }
      />

      {/* BENEFITS */}

      <section className="benefits">

        {[
          [
            c.benefit_1_number ||
              "24/7",
            c.benefit_1_text ||
              "Enhanced Security",
          ],
          [
            c.benefit_2_number ||
              "99.9%",
            c.benefit_2_text ||
              "Reliable Access",
          ],
          [
            c.benefit_3_number ||
              "Smart",
            c.benefit_3_text ||
              "Multiple Unlock Options",
          ],
          [
            c.benefit_4_number ||
              "Premium",
            c.benefit_4_text ||
              "Modern & Elegant Design",
          ],
        ].map(
          ([
            number,
            text,
          ]) => (
            <div
              key={
                number
              }
            >
              <b>
                {number}
              </b>

              <span>
                {text}
              </span>
            </div>
          )
        )}

      </section>

      {/* CATEGORIES */}

      <section className="section">

        <div className="eyebrow">
          {c.categories_label ||
            "OUR SECURITY SOLUTIONS"}
        </div>

        <h2>
          {c.categories_title ||
            "LOCKS FOR EVERY SPACE."}
        </h2>

        <p className="lead">
          {c.categories_description ||
            "Explore our range of smart security locks designed for homes, offices and commercial spaces."}
        </p>

        <div className="cat-grid">

          {data.cats
            .slice(0, 4)
            .map(
              (
                category
              ) => (
                <article
                  className="cat-card"
                  key={
                    category.id ||
                    category.slug
                  }
                  onClick={() =>
                    navigate(
                      "/shop?category=" +
                        category.slug
                    )
                  }
                  style={{
                    backgroundImage: `
                      linear-gradient(
                        0deg,
                        rgba(0,0,0,.8),
                        transparent
                      ),
                      url("${category.image}")
                    `,
                  }}
                >

                  <h3>
                    {String(
                      category.name ||
                        ""
                    ).toUpperCase()}
                  </h3>

                  <p>
                    {
                      category.description
                    }
                  </p>

                  <small>
                    EXPLORE →
                  </small>

                </article>
              )
            )}

        </div>

      </section>

      {/* FEATURED PRODUCTS */}

      <section className="section light">

        <div className="eyebrow">
          {c.products_label ||
            "FEATURED PRODUCTS"}
        </div>

        <h2>
          {c.products_title ||
            "SMART LOCKS. STRONGER SECURITY."}
        </h2>

        <div className="product-grid">

          {data.products
            .slice(0, 4)
            .map(
              (
                product
              ) => (
                <ProductCard
                  key={
                    product.id
                  }
                  p={
                    product
                  }
                  add={add}
                  navigate={
                    navigate
                  }
                />
              )
            )}

        </div>

      </section>

      {/* TECHNOLOGY */}

      <section className="dark-section">

        <div className="eyebrow">
          {c.tech_label ||
            "× THE KULUF DIFFERENCE"}
        </div>

        <h2>
          {c.tech_title ||
            "MORE THAN A LOCK."}

          <br />

          <span>
            {c.tech_title_second ||
              "IT'S INTELLIGENCE."}
          </span>
        </h2>

        <p>
          {c.tech_description ||
            "Advanced technology, premium design and reliable protection — built for a safer tomorrow."}
        </p>

        <div className="feature-grid">

          {[
            [
              "◉",
              c.feature_1_title ||
                "MULTIPLE ACCESS",
              c.feature_1_text ||
                "Fingerprint, PIN, RFID, Mobile App & Key",
            ],
            [
              "◎",
              c.feature_2_title ||
                "REMOTE ACCESS",
              c.feature_2_text ||
                "Control and monitor from anywhere",
            ],
            [
              "◌",
              c.feature_3_title ||
                "REAL-TIME ALERTS",
              c.feature_3_text ||
                "Get notified about unauthorized access",
            ],
            [
              "◇",
              c.feature_4_title ||
                "ANTI-THEFT DESIGN",
              c.feature_4_text ||
                "Built with advanced security features",
            ],
            [
              "◈",
              c.feature_5_title ||
                "LONG BATTERY LIFE",
              c.feature_5_text ||
                "Reliable performance",
            ],
            [
              "✦",
              c.feature_6_title ||
                "EASY INSTALLATION",
              c.feature_6_text ||
                "Professional setup with minimal hassle",
            ],
          ].map(
            ([
              icon,
              title,
              text,
            ]) => (
              <div
                className="feature"
                key={
                  title
                }
              >
                <i>
                  {icon}
                </i>

                <b>
                  {title}
                </b>

                <small>
                  {text}
                </small>
              </div>
            )
          )}

        </div>

      </section>

      {/* LIFESTYLE CAROUSEL */}

      <LifestyleCarousel
  navigate={navigate}
  content={c}
/>

      {/* PROCESS */}

      <section className="section process">

        <div className="eyebrow">
          {c.process_label ||
            "HOW KULUF WORKS"}
        </div>

        <h2>
          {c.process_title ||
            "A SIMPLE PROCESS. A SAFER TOMORROW."}
        </h2>

        <div className="steps">

          {[
            [
              "01",
              c.step_1_title ||
                "ASSESS",
              c.step_1_text ||
                "Understand your security needs.",
            ],
            [
              "02",
              c.step_2_title ||
                "RECOMMEND",
              c.step_2_text ||
                "Get the right lock for your space.",
            ],
            [
              "03",
              c.step_3_title ||
                "INSTALL",
              c.step_3_text ||
                "Professional installation and setup.",
            ],
            [
              "04",
              c.step_4_title ||
                "SECURE",
              c.step_4_text ||
                "Enjoy enhanced safety and support.",
            ],
          ].map(
            ([
              number,
              title,
              text,
            ]) => (
              <div
                key={
                  number
                }
              >

                <b>
                  {number}
                </b>

                <h3>
                  {title}
                </h3>

                <p>
                  {text}
                </p>

              </div>
            )
          )}

        </div>

      </section>

      <CTA
        title={
          c.cta_title ||
          "SECURITY DESIGNED FOR YOUR WORLD."
        }
        text={
          c.cta_description
        }
        navigate={
          navigate
        }
      />
    </>
  );
}

/* =========================================================
   ABOUT
   ========================================================= */



function About({ navigate }) {
  const [content, setContent] = useState({});

  // Load About-page content from the existing CMS.
  useEffect(() => {
    let active = true;

    api("/api/content")
      .then((data) => {
        if (active) {
          setContent(data || {});
        }
      })
      .catch((error) => {
        console.error("Failed to load About content:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const c = content;

  // Premium scroll reveals: enter to reveal, leave to hide.
  useEffect(() => {
    const root = document.querySelector(".kuluf-about");
    if (!root) return undefined;

    const selectors = [
      ".ka-intro-label",
      ".ka-intro > h2",
      ".ka-intro-bottom",
      ".ka-story-image",
      ".ka-story-copy",
      ".ka-philosophy .ka-section-top",
      ".ka-principle",
      ".ka-mission-visual",
      ".ka-mission-copy",
      ".ka-solutions .ka-section-top",
      ".ka-solution-card",
      ".ka-values-heading",
      ".ka-value-row",
      ".ka-stat",
      ".ka-promise-content",
      ".ka-promise-mark",
    ];

    const elements = root.querySelectorAll(selectors.join(", "));
    if (!elements.length) return undefined;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("ka-visible");
      });

      return undefined;
    }

    elements.forEach((element, index) => {
      element.classList.add("ka-reveal");
      element.style.setProperty(
        "--ka-reveal-delay",
        `${(index % 4) * 80}ms`
      );
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle(
            "ka-visible",
            entry.isIntersecting
          );
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -6% 0px",
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();

      elements.forEach((element) => {
        element.classList.remove("ka-reveal", "ka-visible");
        element.style.removeProperty("--ka-reveal-delay");
      });
    };
  }, [content]);

  // Core design principles.
  const principles = [
    {
      number: "01",
      title: "THOUGHTFUL DESIGN",
      description:
        "Security that works naturally with your space, combining considered design with everyday functionality.",
      symbol: "✳",
    },
    {
      number: "02",
      title: "INTELLIGENT ACCESS",
      description:
        "Modern technology that makes access more intuitive, convenient, and suited to the way you live.",
      symbol: "⌘",
    },
    {
      number: "03",
      title: "PEACE OF MIND",
      description:
        "Protection is more than a product. It is the confidence to focus on what matters most.",
      symbol: "◈",
    },
  ];

  // Security solutions.
  const solutions = [
    {
      number: "01",
      title: "RESIDENTIAL",
      subtitle: "Your home. Your peace of mind.",
      description:
        "Explore security solutions designed for personal spaces, everyday routines, and convenient access.",
      image:
        c.about_residential_image ||
        "/uploads/about-residential.svg",
    },
    {
      number: "02",
      title: "COMMERCIAL",
      subtitle: "Confidence at work.",
      description:
        "Discover access solutions for offices, commercial properties, and the people who keep them moving.",
      image:
        c.about_commercial_image ||
        "/uploads/about-commercial.svg",
    },
    {
      number: "03",
      title: "INDUSTRIAL",
      subtitle: "Security for demanding spaces.",
      description:
        "Explore options for operational environments where access requirements need careful consideration.",
      image:
        c.about_industrial_image ||
        "/uploads/about-industrial.svg",
    },
  ];

  // KULUF values.
  const values = [
    {
      number: "01",
      title: "RELIABILITY",
      description:
        "Dependable solutions selected around real spaces and everyday requirements.",
    },
    {
      number: "02",
      title: "INNOVATION",
      description:
        "Modern technology with a practical purpose: making security easier to use.",
    },
    {
      number: "03",
      title: "SIMPLICITY",
      description:
        "Clear choices, intuitive experiences, and less complexity in everyday access.",
    },
    {
      number: "04",
      title: "CUSTOMER FIRST",
      description:
        "Understanding individual needs before helping customers choose the right solution.",
    },
  ];

  // Display statistics only when CMS values exist.
  const stats = [
    [c.stat_1_number, c.stat_1_text],
    [c.stat_2_number, c.stat_2_text],
    [c.stat_3_number, c.stat_3_text],
    [c.stat_4_number, c.stat_4_text],
  ].filter(([number, text]) => number || text);

  return (
    <div className="kuluf-about">
      {/* HERO */}
      <Hero
        title={c.about_title || "SECURITY. REIMAGINED."}
        description={
          c.about_story ||
          "KULUF Total Security brings thoughtful design and modern security solutions together to help protect the spaces that matter."
        }
        image={c.about_hero_image || "/uploads/about-hero.svg"}
        label={c.about_hero_label || "THE KULUF STORY"}
        primaryText={c.about_primary_text || "EXPLORE PRODUCTS →"}
        primaryLink={c.about_primary_link || "/shop"}
        secondaryText={c.about_secondary_text || "TALK TO OUR TEAM →"}
        secondaryLink={c.about_secondary_link || "/contact"}
        navigate={navigate}
      />

      {/* INTRODUCTION */}
      <section className="ka-intro">
        <div className="ka-intro-label">
          <span className="ka-gold-dot" />
          MORE THAN A LOCK
        </div>

        <h2>
          PROTECTION IS
          <br />
          PERSONAL. <span>SECURITY IS OUR PURPOSE.</span>
        </h2>

        <div className="ka-intro-bottom">
          <p>
            The spaces we live and work in hold what matters most. We believe
            security should be considered, intuitive, and designed around the
            people who depend on it.
          </p>

          <span className="ka-intro-mark">K.</span>
        </div>
      </section>

      {/* OUR STORY */}
      <section className="ka-story">
        <div className="ka-story-image">
          <img
            src={c.about_story_image || "/uploads/about-office.svg"}
            alt="Contemporary architectural space representing the KULUF approach to security"
            loading="lazy"
          />

          <div className="ka-image-index">01 / OUR STORY</div>
        </div>

        <div className="ka-story-copy">
          <div className="eyebrow">OUR STORY</div>

          <h2>
            INNOVATION
            <br />
            MEETS <span>INTENTION.</span>
          </h2>

          <p>
            {c.about_story ||
              "KULUF Total Security brings together modern technology, thoughtful design, and practical security solutions for contemporary spaces."}
          </p>

          <p>
            From homes to professional environments, every space has different
            needs. Our approach starts with understanding those needs and
            helping customers explore solutions that fit the way they live and
            work.
          </p>

          <button
            type="button"
            className="ka-link-button"
            onClick={() => navigate("/shop")}
          >
            DISCOVER KULUF <span>↗</span>
          </button>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section className="ka-philosophy">
        <div className="ka-section-top">
          <div>
            <div className="eyebrow">THE WAY WE THINK</div>

            <h2>
              SECURITY WITH
              <br />
              <span>A CLEAR PURPOSE.</span>
            </h2>
          </div>

          <p>
            Better security begins with better questions: what matters, who
            needs access, and how should protection fit into everyday life?
          </p>
        </div>

        <div className="ka-principles">
          {principles.map((item) => (
            <article className="ka-principle" key={item.number}>
              <div className="ka-principle-top">
                <span>{item.number}</span>
                <span className="ka-principle-symbol">{item.symbol}</span>
              </div>

              <h3>{item.title}</h3>
              <p>{item.description}</p>

              <div className="ka-card-rule" />
            </article>
          ))}
        </div>
      </section>

      {/* MISSION AND VISION */}
      <section className="ka-mission">
        <div className="ka-mission-visual">
          <img
            src={c.about_mission_image || "/uploads/about-lock.svg"}
            alt="Modern security hardware and architectural details"
            loading="lazy"
          />

          <div className="ka-visual-caption">
            <span>KULUF TOTAL SECURITY</span>
            <span>DESIGNED FOR MODERN LIVING</span>
          </div>
        </div>

        <div className="ka-mission-copy">
          <div className="eyebrow">01 — OUR MISSION</div>

          <h2>
            MAKING SECURITY
            <br />
            <span>MORE INTUITIVE.</span>
          </h2>

          <p>
            {c.about_mission ||
              "Our mission is to make everyday security easier to understand and use through thoughtfully selected solutions and modern technology."}
          </p>

          <div className="ka-mission-divider" />

          <div className="eyebrow">02 — OUR VISION</div>

          <h3>
            A MORE
            <br />
            CONFIDENT FUTURE.
          </h3>

          <p>
            {c.about_vision ||
              "We envision a future where people can make informed security choices and protection feels like a natural part of every space."}
          </p>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section className="ka-solutions">
        <div className="ka-section-top">
          <div>
            <div className="eyebrow">WHERE WE FIT</div>

            <h2>
              ONE PURPOSE.
              <br />
              <span>DIFFERENT SPACES.</span>
            </h2>
          </div>

          <p>
            Every environment has its own access requirements. Explore the
            spaces our security solutions are designed to serve.
          </p>
        </div>

        <div className="ka-solutions-grid">
          {solutions.map((item) => (
            <article className="ka-solution-card" key={item.number}>
              <button
                type="button"
                className="ka-solution-image"
                onClick={() => navigate("/shop")}
                aria-label={`Explore ${item.title.toLowerCase()} security products`}
              >
                <img
                  src={item.image}
                  alt={`${item.title.toLowerCase()} security solutions`}
                  loading="lazy"
                />

                <span className="ka-solution-number">{item.number}</span>
                <span className="ka-image-arrow">↗</span>
              </button>

              <div className="ka-solution-copy">
                <div className="ka-solution-kicker">
                  KULUF / {item.number}
                </div>

                <h3>{item.title}</h3>
                <h4>{item.subtitle}</h4>
                <p>{item.description}</p>

                <button
                  type="button"
                  className="ka-link-button"
                  onClick={() => navigate("/shop")}
                >
                  EXPLORE PRODUCTS <span>↗</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* VALUES */}
      <section className="ka-values">
        <div className="ka-values-heading">
          <div className="eyebrow">THE KULUF STANDARD</div>

          <h2>
            PRINCIPLES THAT
            <br />
            <span>MOVE US FORWARD.</span>
          </h2>

          <p>
            The details matter. These are the principles that guide how we
            approach security, technology, and customer experience.
          </p>
        </div>

        <div className="ka-values-list">
          {values.map((item) => (
            <article className="ka-value-row" key={item.number}>
              <span className="ka-value-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>

              <span className="ka-value-arrow" aria-hidden="true">
                ↗
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* OPTIONAL CMS STATISTICS */}
      {stats.length > 0 && (
        <section className="ka-stats">
          {stats.map(([number, text], index) => (
            <div
              className="ka-stat"
              key={`${number || "stat"}-${index}`}
            >
              {number && <strong>{number}</strong>}
              {text && <span>{text}</span>}
            </div>
          ))}
        </section>
      )}

      {/* KULUF PROMISE */}
      <section className="ka-promise">
        <div className="ka-promise-content">
          <div className="eyebrow">THE KULUF PROMISE</div>

          <h2>
            DESIGNED WITH PURPOSE.
            <br />
            BUILT AROUND
            <br />
            <span>PEACE OF MIND.</span>
          </h2>

          <p>
            Security should support life, not complicate it. We are here to
            help you explore thoughtful solutions for the spaces you value.
          </p>

          <button
            type="button"
            className="ka-promise-button"
            onClick={() => navigate("/contact")}
          >
            LET'S TALK SECURITY <span>↗</span>
          </button>
        </div>

        <div className="ka-promise-mark" aria-hidden="true">
          K<span>.</span>
        </div>
      </section>

      {/* FINAL CTA */}
      <CTA
        title={c.about_cta || "MAKE ROOM FOR PEACE OF MIND."}
        text={
          c.about_cta_description ||
          "Explore security solutions designed around your space and your needs."
        }
        navigate={navigate}
      />
    </div>
  );
}
/* =========================================================
   SHOP
   ========================================================= */

function Shop({
  add,
  navigate,
}) {
  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    sort,
    setSort,
  ] = useState(
    "featured"
  );

  useEffect(() => {
    api(
      "/api/products"
    )
      .then(
        setProducts
      )
      .catch(
        () =>
          setProducts([])
      );
  }, []);

  let list =
    products.filter(
      (product) =>
        `${product.name} ${
          product.description ||
          ""
        } ${
          product.short_description ||
          ""
        }`
          .toLowerCase()
          .includes(
            query.toLowerCase()
          )
    );

  if (sort === "low") {
    list.sort(
      (a, b) =>
        Number(
          a.sale_price ||
            a.price
        ) -
        Number(
          b.sale_price ||
            b.price
        )
    );
  }

  if (sort === "high") {
    list.sort(
      (a, b) =>
        Number(
          b.sale_price ||
            b.price
        ) -
        Number(
          a.sale_price ||
            a.price
        )
    );
  }

  return (
    <section className="section">

      <div className="eyebrow">
        KULUF PRODUCTS
      </div>

      <h2>
        SMART SECURITY.
        <br />
        <span>
          DESIGNED FOR YOU.
        </span>
      </h2>

      <div className="shopbar">

        <input
          placeholder="Search locks..."
          value={query}
          onChange={(e) =>
            setQuery(
              e.target.value
            )
          }
        />

        <select
          value={sort}
          onChange={(e) =>
            setSort(
              e.target.value
            )
          }
        >
          <option value="featured">
            Featured
          </option>

          <option value="low">
            Price Low → High
          </option>

          <option value="high">
            Price High → Low
          </option>
        </select>

      </div>

      <div className="product-grid">

        {list.map(
          (product) => (
            <ProductCard
              key={
                product.id
              }
              p={
                product
              }
              add={add}
              navigate={
                navigate
              }
            />
          )
        )}

      </div>

    </section>
  );
}

/* =========================================================
   PRODUCT CARD
   ========================================================= */

function ProductCard({
  p,
  add,
  navigate,
}) {
  const image =
    p.images?.[0]
      ?.url ||
    "/uploads/product-default.svg";

  return (
    <article className="product-card">

      <div
        className="product-image"
        onClick={() =>
          navigate(
            "/product/" +
              p.slug
          )
        }
      >

        <img
          src={image}
          alt={
            p.name
          }
        />

        {p.badge && (
          <span>
            {p.badge}
          </span>
        )}

      </div>

      <h3>
        {p.name}
      </h3>

      <p>
        {p.short_description}
      </p>

      <div className="price">

        {p.sale_price ? (
          <>
            <del>
              {money(
                p.price
              )}
            </del>{" "}
            {money(
              p.sale_price
            )}
          </>
        ) : (
          money(
            p.price
          )
        )}

      </div>

      <button
        onClick={() =>
          add(p.id)
        }
      >
        ADD TO CART
      </button>

      <button
        className="secondary"
        onClick={() =>
          navigate(
            "/product/" +
              p.slug
          )
        }
      >
        VIEW PRODUCT
      </button>

    </article>
  );
}

/* =========================================================
   PRODUCT DETAILS
   ========================================================= */

function Product({
  slug,
  add,
  navigate,
}) {
  const [
    product,
    setProduct,
  ] = useState(null);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState("");

  useEffect(() => {
    api(
      "/api/products/" +
        slug
    )
      .then(
        (data) => {
          setProduct(
            data
          );

          setSelectedImage(
            data.images?.[0]
              ?.url ||
              "/uploads/product-default.svg"
          );
        }
      )
      .catch(() =>
        setProduct(
          false
        )
      );
  }, [slug]);

  if (
    product === null
  ) {
    return <Loader />;
  }

  if (!product) {
    return (
      <NotFound
        navigate={
          navigate
        }
      />
    );
  }

  return (
    <section className="section product-detail">

      <div className="gallery">

        <img
          src={
            selectedImage
          }
          alt={
            product.name
          }
        />

        <div>

          {product.images?.map(
            (item) => (
              <img
                key={
                  item.url
                }
                src={
                  item.url
                }
                alt=""
                onClick={() =>
                  setSelectedImage(
                    item.url
                  )
                }
              />
            )
          )}

        </div>

      </div>

      <div className="detail-copy">

        <div className="eyebrow">
          {product.category_name ||
            "KULUF SECURITY"}
        </div>

        <h1>
          {product.name}
        </h1>

        <div className="big-price">

          {product.sale_price ? (
            <>
              <del>
                {money(
                  product.price
                )}
              </del>{" "}
              {money(
                product.sale_price
              )}
            </>
          ) : (
            money(
              product.price
            )
          )}

        </div>

        <p>
          {
            product.short_description
          }
        </p>

        <button
          onClick={() =>
            add(
              product.id
            )
          }
        >
          ADD TO CART →
        </button>

        <button
          className="outline"
          onClick={async () => {
            await add(
              product.id
            );

            navigate(
              "/cart"
            );
          }}
        >
          BUY NOW →
        </button>

        <div className="tabs">

          <h3>
            Description
          </h3>

          <p>
            {
              product.description
            }
          </p>

          <h3>
            Specifications
          </h3>

          <p>
            {
              product.specifications
            }
          </p>

          {product.access_methods && (
            <>
              <h3>
                Access Methods
              </h3>

              <p>
                {
                  product.access_methods
                }
              </p>
            </>
          )}

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   CART
   ========================================================= */




function Cart({ cart, reload, navigate }) {
  const [busyItems, setBusyItems] = React.useState([]);
  const [cartError, setCartError] = React.useState("");
  const [updating, setUpdating] = React.useState(false);

  const items = Array.isArray(cart?.items) ? cart.items : [];

  // Your backend returns ci.id AS cart_item_id.
  const getItemId = (item) => item.cart_item_id ?? item.id;

  const getPrice = (item) =>
    Math.max(
      0,
      Number(item.sale_price ?? item.salePrice ?? item.price ?? 0) || 0
    );

  const getStock = (item) => {
    const stock = Number(item.stock);
    return Number.isFinite(stock) ? Math.max(0, stock) : Infinity;
  };

  const totalQuantity = items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
    0
  );

  const total = items.reduce(
    (sum, item) =>
      sum + getPrice(item) * Math.max(0, Number(item.quantity) || 0),
    0
  );

  const isBusy = (id) =>
    id != null && busyItems.includes(String(id));

  const setItemBusy = (id, busy) => {
    const key = String(id);

    setBusyItems((current) =>
      busy
        ? current.includes(key)
          ? current
          : [...current, key]
        : current.filter((value) => value !== key)
    );
  };

  const getErrorMessage = (error, action) => {
    const message = String(error?.message || "");

    if (/cart item not found/i.test(message)) {
      return "This cart item no longer exists in your active cart. Refresh the page and try again.";
    }

    if (/only \d+ in stock/i.test(message)) {
      return message;
    }

    if (/401|unauthorized|token/i.test(message)) {
      return "Your session may have expired. Sign in again, then refresh your cart.";
    }

    return message || `Unable to ${action}. Please try again.`;
  };

  const removeItem = async (item) => {
    const id = getItemId(item);

    if (id == null) {
      setCartError("Cart item ID is missing. Refresh the page and try again.");
      return;
    }

    if (isBusy(id)) return;

    setCartError("");
    setItemBusy(id, true);

    try {
      await api(`/api/cart/items/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      // Reload the server's authoritative cart.
      await reload();
    } catch (error) {
      console.error("Remove cart item failed:", error);
      setCartError(getErrorMessage(error, "remove this item"));
    } finally {
      setItemBusy(id, false);
    }
  };

  const changeQuantity = async (item, delta) => {
    const id = getItemId(item);

    if (id == null) {
      setCartError("Cart item ID is missing. Refresh and try again.");
      return;
    }

    if (isBusy(id)) return;

    const currentQuantity = Math.max(1, Number(item.quantity) || 1);
    const nextQuantity = currentQuantity + delta;
    const stock = getStock(item);

    if (nextQuantity < 1) {
      await removeItem(item);
      return;
    }

    if (nextQuantity > stock) {
      setCartError(
        stock === 0
          ? "This product is currently out of stock."
          : `Only ${stock} unit${stock === 1 ? "" : "s"} available in stock.`
      );
      return;
    }

    setCartError("");
    setUpdating(true);
    setItemBusy(id, true);

    try {
      await api(`/api/cart/items/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: nextQuantity }),
      });

      await reload();
    } catch (error) {
      console.error("Update cart quantity failed:", error);
      setCartError(getErrorMessage(error, "update the quantity"));
    } finally {
      setUpdating(false);
      setItemBusy(id, false);
    }
  };

  if (items.length === 0) {
    return (
      <section className="section empty kuluf-cart">
        <div className="eyebrow">YOUR KULUF CART</div>

        <div className="kuluf-cart-empty-icon" aria-hidden="true">
          🛒
        </div>

        <h1>YOUR CART IS EMPTY</h1>
        <p>Your next layer of security starts with the right product.</p>

        <button type="button" onClick={() => navigate("/shop")}>
          EXPLORE PRODUCTS →
        </button>
      </section>
    );
  }

  return (
    <section className="section kuluf-cart">
      <div className="eyebrow">YOUR KULUF CART</div>

      <h2>
        SECURE YOUR <span>ORDER.</span>
      </h2>

      <p className="kuluf-cart-count" aria-live="polite">
        {totalQuantity} {totalQuantity === 1 ? "ITEM" : "ITEMS"} IN YOUR CART
      </p>

      {cartError && (
        <div className="kuluf-cart-error" role="alert">
          <span>{cartError}</span>
          <button
            type="button"
            onClick={() => setCartError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="kuluf-cart-layout">
        <div className="cart-list">
          {items.map((item, index) => {
            const id = getItemId(item);
            const busy = isBusy(id);
            const quantity = Math.max(1, Number(item.quantity) || 1);
            const price = getPrice(item);
            const stock = getStock(item);

            return (
              <article
                className="cart-row kuluf-cart-row"
                key={id ?? `${item.product_id ?? item.name}-${index}`}
              >
                <div className="kuluf-cart-image">
                  <img
                    src={item.image || "/uploads/product-default.svg"}
                    alt={item.name || "KULUF product"}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src =
                        "/uploads/product-default.svg";
                    }}
                  />
                </div>

                <div className="kuluf-cart-details">
                  <h3>{item.name || "KULUF Product"}</h3>

                  <p className="kuluf-cart-unit-price">
                    {money(price)} each
                  </p>

                  <div className="kuluf-cart-actions">
                    <div className="kuluf-quantity-control">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={busy}
                        onClick={() => changeQuantity(item, -1)}
                      >
                        −
                      </button>

                      <span aria-live="polite">{quantity}</span>

                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={busy || quantity >= stock}
                        onClick={() => changeQuantity(item, 1)}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="kuluf-remove-button"
                      disabled={busy}
                      onClick={() => removeItem(item)}
                    >
                      {busy ? "UPDATING…" : "REMOVE"}
                    </button>
                  </div>

                  {Number.isFinite(stock) && (
                    <p className="kuluf-cart-unit-price">
                      {stock > 0 ? `${stock} available in stock` : "Out of stock"}
                    </p>
                  )}
                </div>

                <div className="kuluf-cart-line-total">
                  {money(price * quantity)}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="kuluf-cart-summary">
          <div className="eyebrow">ORDER SUMMARY</div>

          <div className="kuluf-summary-line">
            <span>Items ({totalQuantity})</span>
            <span>{money(total)}</span>
          </div>

          <div className="kuluf-summary-line">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>

          <div className="kuluf-summary-total">
            <span>Subtotal</span>
            <strong>{money(total)}</strong>
          </div>

          <p className="kuluf-summary-note">
            Final shipping, taxes, and applicable discounts will be confirmed
            at checkout.
          </p>

          <button
            type="button"
            className="kuluf-checkout-button"
            disabled={updating || busyItems.length > 0}
            onClick={() => navigate("/checkout")}
          >
            PROCEED TO CHECKOUT →
          </button>

          <button
            type="button"
            className="kuluf-continue-button"
            onClick={() => navigate("/shop")}
          >
            CONTINUE SHOPPING
          </button>
        </aside>
      </div>
    </section>
  );
}


/* =========================================================
   CHECKOUT
   ========================================================= */


function Checkout({ cart, navigate }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const items = cart?.items || [];

  const subtotal = items.reduce((sum, item) => {
    return (
      sum +
      Number(item.sale_price ?? item.price ?? 0) *
        Number(item.quantity || 0)
    );
  }, 0);

  const moneyLabel = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Load Razorpay Checkout.js only when needed.
  const loadRazorpay = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => resolve(true),
          { once: true }
        );

        existingScript.addEventListener(
          "error",
          () => reject(new Error("Unable to load Razorpay.")),
          { once: true }
        );

        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;

      script.onload = () => resolve(true);
      script.onerror = () =>
        reject(new Error("Unable to load Razorpay. Check your internet connection."));

      document.body.appendChild(script);
    });

  const submit = async (event) => {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!localStorage.getItem("kuluf_token")) {
      setError("Please log in before placing an order.");
      return;
    }

    if (!items.length) {
      setError("Your cart is empty. Please add a product first.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!/^\d{6}$/.test(form.pinCode.trim())) {
      setError("Enter a valid 6-digit PIN code.");
      return;
    }

    setLoading(true);

    let createdOrder = null;

    const shippingAddress = [
      form.address.trim(),
      form.city.trim(),
      form.state.trim(),
      `PIN: ${form.pinCode.trim()}`,
    ].join(", ");

    try {
      // The backend calculates the final total using its
      // own cart and product prices.
      createdOrder = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          shippingAddress,
          billingAddress: shippingAddress,
        }),
      });

      // Request a Razorpay order using the backend's
      // server-calculated order total.
      const paymentOrder = await api(
        "/api/payments/razorpay/order",
        {
          method: "POST",
          body: JSON.stringify({
            orderId: createdOrder.orderId,
          }),
        }
      );

      if (!paymentOrder.keyId || !paymentOrder.id) {
        throw new Error(
          "Payment setup is incomplete. Please contact support with your order number."
        );
      }

      await loadRazorpay();

      const options = {
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency || "INR",
        name: "KULUF Total Security",
        description: `Order ${createdOrder.orderNumber}`,
        order_id: paymentOrder.id,

        prefill: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          contact: form.phone.trim(),
        },

        theme: {
          color: "#C9A66B",
        },

        modal: {
          ondismiss: () => {
            setNotice(
              `Payment was not completed. Your order ${createdOrder.orderNumber} remains pending. You can check its status in My Orders.`
            );
            setLoading(false);
          },
        },

        handler: async (response) => {
          try {
            setError("");
            setNotice("Verifying your payment securely...");

            const verification = await api(
              "/api/payments/razorpay/verify",
              {
                method: "POST",
                body: JSON.stringify({
                  razorpay_order_id:
                    response.razorpay_order_id,
                  razorpay_payment_id:
                    response.razorpay_payment_id,
                  razorpay_signature:
                    response.razorpay_signature,
                  orderId: createdOrder.orderId,
                }),
              }
            );

            if (!verification.ok) {
              throw new Error(
                "Payment could not be confirmed by the server."
              );
            }

            setConfirmedOrder(createdOrder);
            setNotice("");
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          } catch (verificationError) {
            setError(
              `${verificationError.message} Your order number is ${createdOrder.orderNumber}. Please contact support before attempting another payment.`
            );
            setNotice("");
          } finally {
            setLoading(false);
          }
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response) => {
        setError(
          response.error?.description ||
            "Payment failed. Your order may remain pending. Check My Orders before trying again."
        );
        setLoading(false);
      });

      razorpay.open();
    } catch (err) {
      setError(
        createdOrder
          ? `${err.message} Your order ${createdOrder.orderNumber} may already have been created. Check My Orders before submitting again.`
          : err.message || "Unable to start checkout. Please try again."
      );

      setLoading(false);
    }
  };

  if (confirmedOrder) {
    return (
      <section className="section checkout-success">
        <div className="checkout-success-icon" aria-hidden="true">
          ✓
        </div>

        <div className="eyebrow">
          PAYMENT VERIFIED
        </div>

        <h1>
          THANK YOU FOR{" "}
          <span>YOUR ORDER.</span>
        </h1>

        <p>
          Your payment has been verified by KULUF.
          Your order has been submitted successfully.
        </p>

        <div className="checkout-success-details">
          <span>ORDER NUMBER</span>
          <strong>{confirmedOrder.orderNumber}</strong>

          <span>ORDER TOTAL</span>
          <strong>{moneyLabel(confirmedOrder.total)}</strong>

          <span>PAYMENT STATUS</span>
          <strong>Paid</strong>
        </div>

        <button
          type="button"
          onClick={() => navigate("/orders")}
        >
          VIEW MY ORDERS →
        </button>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="section empty">
        <div className="eyebrow">CHECKOUT</div>

        <h1>YOUR CART IS EMPTY.</h1>

        <p>
          Add a security product to your cart before checking out.
        </p>

        <button
          type="button"
          onClick={() => navigate("/shop")}
        >
          EXPLORE PRODUCTS →
        </button>
      </section>
    );
  }

  return (
    <section className="checkout-page">
      <div className="checkout-container">
        <div className="eyebrow">SECURE CHECKOUT</div>

        <h1 className="checkout-title">
          COMPLETE YOUR{" "}
          <span>ORDER.</span>
        </h1>

        <p className="checkout-intro">
          Enter your delivery details and continue to secure payment.
        </p>

        <div className="checkout-layout">
          <form
            className="checkout-form checkout-delivery-form"
            onSubmit={submit}
          >
            <div className="checkout-block-heading">
              <span>01</span>
              <div>
                <h2>Delivery information</h2>
                <p>Where should we deliver your order?</p>
              </div>
            </div>

            <div className="checkout-fields">
              <label className="checkout-field">
                <span>Full name</span>
                <input
                  required
                  name="name"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={updateField}
                  maxLength={100}
                />
              </label>

              <label className="checkout-field">
                <span>Email address</span>
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={updateField}
                  maxLength={254}
                />
              </label>

              <label className="checkout-field">
                <span>Mobile number</span>
                <input
                  required
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={updateField}
                  maxLength={10}
                />
              </label>

              <label className="checkout-field checkout-field-full">
                <span>Street address</span>
                <input
                  required
                  name="address"
                  autoComplete="street-address"
                  placeholder="House number, building, street"
                  value={form.address}
                  onChange={updateField}
                  maxLength={250}
                />
              </label>

              <label className="checkout-field">
                <span>City</span>
                <input
                  required
                  name="city"
                  autoComplete="address-level2"
                  placeholder="City"
                  value={form.city}
                  onChange={updateField}
                  maxLength={100}
                />
              </label>

              <label className="checkout-field">
                <span>State</span>
                <input
                  required
                  name="state"
                  autoComplete="address-level1"
                  placeholder="State"
                  value={form.state}
                  onChange={updateField}
                  maxLength={100}
                />
              </label>

              <label className="checkout-field">
                <span>PIN code</span>
                <input
                  required
                  name="pinCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="6-digit PIN code"
                  value={form.pinCode}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      pinCode: event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    }))
                  }
                  maxLength={6}
                />
              </label>
            </div>

            {error && (
              <div className="checkout-message checkout-error" role="alert">
                {error}
              </div>
            )}

            {notice && (
              <div className="checkout-message checkout-notice" role="status">
                {notice}
              </div>
            )}

            <div className="checkout-security-note">
              <span aria-hidden="true">◇</span>
              <p>
                Your payment is processed through Razorpay.
                KULUF does not store your card details.
              </p>
            </div>

            <button
              className="checkout-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "PROCESSING..."
                : "CONTINUE TO SECURE PAYMENT →"}
            </button>
          </form>

          <aside className="checkout-summary">
            <div className="checkout-summary-heading">
              <div className="eyebrow">YOUR PURCHASE</div>
              <h2>Order summary</h2>
            </div>

            <div className="checkout-summary-items">
              {items.map((item) => (
                <div
                  className="checkout-summary-item"
                  key={item.id}
                >
                  <img
                    src={
                      item.image ||
                      "/uploads/product-default.svg"
                    }
                    alt={item.name || "Security product"}
                  />

                  <div className="checkout-summary-item-copy">
                    <strong>{item.name}</strong>
                    <span>Quantity: {item.quantity}</span>
                  </div>

                  <strong>
                    {moneyLabel(
                      Number(item.sale_price ?? item.price ?? 0) *
                        Number(item.quantity || 0)
                    )}
                  </strong>
                </div>
              ))}
            </div>

            <div className="checkout-summary-total">
              <span>Cart subtotal (estimate)</span>
              <strong>{moneyLabel(subtotal)}</strong>
            </div>

            <p className="checkout-summary-note">
              Final shipping, discounts, taxes and total are
              calculated by the server when your order is created.
            </p>

            <div className="checkout-trust">
              <span aria-hidden="true">✓</span>
              Secure payment verification
            </div>

            <div className="checkout-trust">
              <span aria-hidden="true">✓</span>
              Server-calculated order total
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   LOGIN
   ========================================================= */


function Login({ setUser, navigate }) {
  const [register, setRegister] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Update form fields.
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Register a new account or log in an existing user.
  const submit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    const email = String(form.email || "")
      .trim()
      .toLowerCase();

    try {
      const data = await api(
        register ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            email,
          }),
        }
      );

      // Registration sends an OTP; it does not log the
      // new user in immediately.
      if (register) {
        if (data.requiresVerification) {
          setPendingEmail(data.email || email);
          setShowOtp(true);
          setOtp("");
          setMessage(
            data.message ||
              "A verification code has been sent to your Gmail."
          );
          return;
        }

        setError(
          "The server did not confirm email verification was required. Please check the registration response."
        );
        return;
      }

      // A successful login must return a token and user.
      if (!data.token || !data.user) {
        setError(
          "Login response is incomplete. Please try again."
        );
        return;
      }

      localStorage.setItem("kuluf_token", data.token);
      setUser(data.user);

      navigate(
        data.user.role === "admin" ? "/admin" : "/account"
      );
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Verify the six-digit code sent to the user's email.
  const verifyOtp = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Please enter a valid six-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const data = await api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email: pendingEmail,
          otp: otp.trim(),
        }),
      });

      setShowOtp(false);
      setRegister(false);
      setOtp("");

      setForm((previous) => ({
        ...previous,
        email: pendingEmail,
        password: "",
      }));

      setMessage(
        data.message ||
          "Email verified successfully. You can now log in."
      );
    } catch (err) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // Return to the regular login form.
  const backToLogin = (event) => {
    event.preventDefault();

    setShowOtp(false);
    setRegister(false);
    setOtp("");
    setError("");
    setMessage("");
  };

  // Switch between signup and login.
  const toggleRegister = (event) => {
    event.preventDefault();

    setRegister((previous) => !previous);
    setError("");
    setMessage("");
  };

  return (
    <section className="auth">
      <form onSubmit={showOtp ? verifyOtp : submit}>
        <div className="eyebrow">KULUF ACCOUNT</div>

        <h1>
          {showOtp
            ? "VERIFY YOUR EMAIL"
            : register
              ? "CREATE ACCOUNT"
              : "WELCOME BACK"}
        </h1>

        {showOtp ? (
          <>
            <p>
              Enter the six-digit verification code sent to{" "}
              <strong>{pendingEmail}</strong>.
            </p>

            <input
              required
              type="text"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter 6-digit OTP"
              aria-label="Email verification code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={otp}
              onChange={(event) =>
                setOtp(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
            />

            {message && (
              <p role="status">{message}</p>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}>
              {loading ? "VERIFYING..." : "VERIFY EMAIL →"}
            </button>

            <a href="#" onClick={backToLogin}>
              Back to login
            </a>
          </>
        ) : (
          <>
            {register && (
              <input
                required
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Full name"
                value={form.name}
                onChange={handleChange}
              />
            )}

            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Gmail address"
              value={form.email}
              onChange={handleChange}
            />

            <input
              required
              name="password"
              type="password"
              autoComplete={
                register ? "new-password" : "current-password"
              }
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
            />

            {register && (
              <p>
                We'll send a verification code to your Gmail
                before you can sign in.
              </p>
            )}

            {message && (
              <p role="status">{message}</p>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}>
              {loading
                ? "PLEASE WAIT..."
                : register
                  ? "CREATE ACCOUNT →"
                  : "LOGIN →"}
            </button>

            <a href="#" onClick={toggleRegister}>
              {register
                ? "Already have an account? Login"
                : "Create an account"}
            </a>
          </>
        )}
      </form>
    </section>
  );
}


/* =========================================================
   ACCOUNT
   ========================================================= */


function Account({ user, navigate }) {
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const displayName = String(
    user.name || "Customer"
  );

  const initial = displayName
    .trim()
    .charAt(0)
    .toUpperCase() || "C";

  const handleLogout = () => {
    localStorage.removeItem("kuluf_token");
    window.location.href = "/";
  };

  return (
    <section className="account-page">
      <div className="account-shell">
        {/* Page heading */}
        <div className="account-heading">
          <div>
            <div className="eyebrow">
              YOUR KULUF ACCOUNT
            </div>

            <h1>
              Welcome back,{" "}
              <span>{displayName}</span>
            </h1>

            <p>
              Manage your orders and account details
              from one place.
            </p>
          </div>

          <div className="account-avatar" aria-hidden="true">
            {initial}
          </div>
        </div>

        {/* Account identity */}
        <div className="account-identity">
          <div className="account-identity-icon">
            <span aria-hidden="true">✉</span>
          </div>

          <div className="account-identity-copy">
            <span className="account-label">
              SIGNED IN AS
            </span>

            <strong>{user.email}</strong>
          </div>

          <span className="account-verified">
            <span aria-hidden="true">✓</span>
            Account
          </span>
        </div>

        {/* Main account navigation */}
        <div className="account-section-heading">
          <div>
            <div className="eyebrow">
              ACCOUNT MANAGEMENT
            </div>

            <h2>Everything in one place.</h2>
          </div>
        </div>

        <div className="account-dashboard-grid">
          <button
            type="button"
            className="account-dashboard-card"
            onClick={() => navigate("/orders")}
          >
            <span className="account-card-icon" aria-hidden="true">
              ↗
            </span>

            <span className="account-card-title">
              My Orders
            </span>

            <span className="account-card-description">
              View your order history and check your purchases.
            </span>

            <span className="account-card-link">
              VIEW ORDERS <span aria-hidden="true">→</span>
            </span>
          </button>

          <button
            type="button"
            className="account-dashboard-card"
            onClick={() =>
              navigate("/contact")
            }
          >
            <span className="account-card-icon" aria-hidden="true">
              ◇
            </span>

            <span className="account-card-title">
              Customer Support
            </span>

            <span className="account-card-description">
              Contact our team for help with products or orders.
            </span>

            <span className="account-card-link">
              GET SUPPORT <span aria-hidden="true">→</span>
            </span>
          </button>

          <button
            type="button"
            className="account-dashboard-card"
            onClick={() =>
              navigate("/shop")
            }
          >
            <span className="account-card-icon" aria-hidden="true">
              ⌕
            </span>

            <span className="account-card-title">
              Explore Products
            </span>

            <span className="account-card-description">
              Discover security solutions for your space.
            </span>

            <span className="account-card-link">
              EXPLORE SHOP <span aria-hidden="true">→</span>
            </span>
          </button>
        </div>

        {/* Profile information */}
        <div className="account-profile-panel">
          <div className="account-profile-heading">
            <div>
              <div className="eyebrow">
                PERSONAL INFORMATION
              </div>

              <h2>Your account details</h2>
            </div>

            <span
              className="account-profile-symbol"
              aria-hidden="true"
            >
              ◉
            </span>
          </div>

          <div className="account-detail-row">
            <div>
              <span className="account-label">
                FULL NAME
              </span>

              <strong>{displayName}</strong>
            </div>

            <div>
              <span className="account-label">
                EMAIL ADDRESS
              </span>

              <strong>{user.email}</strong>
            </div>
          </div>

          <p className="account-profile-note">
            Need to change your account details? Contact
            our support team for assistance.
          </p>

          <button
            type="button"
            className="account-secondary-button"
            onClick={() => navigate("/contact")}
          >
            CONTACT SUPPORT →
          </button>
        </div>

        {/* Logout */}
        <div className="account-logout-row">
          <div>
            <strong>Leaving so soon?</strong>
            <p>
              Sign out of your KULUF account on this device.
            </p>
          </div>

          <button
            type="button"
            className="account-logout-button"
            onClick={handleLogout}
          >
            SIGN OUT
          </button>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   ORDERS
   ========================================================= */

function Orders({
  user,
  navigate,
}) {
  const [
    orders,
    setOrders,
  ] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate(
        "/login"
      );

      return;
    }

    api(
      "/api/orders"
    )
      .then(
        setOrders
      )
      .catch(
        () => {}
      );
  }, [user]);

  return (
    <section className="section">

      <div className="eyebrow">
        MY ACCOUNT
      </div>

      <h2>
        ORDER{" "}
        <span>
          HISTORY.
        </span>
      </h2>

      {!orders.length ? (
        <p>
          No orders yet.
        </p>
      ) : (
        <div className="order-cards">

          {orders.map(
            (
              order
            ) => (
              <article
                className="order-card"
                key={
                  order.id
                }
              >

                <b>
                  {
                    order.order_number
                  }
                </b>

                <strong>
                  {money(
                    order.total
                  )}
                </strong>

                <span>
                  {
                    order.order_status
                  }
                </span>

              </article>
            )
          )}

        </div>
      )}

    </section>
  );
}

/* =========================================================
   CONTACT
   ========================================================= */

function Contact() {
  const submit = (
    event
  ) => {
    event.preventDefault();

    alert(
      "Thank you. Your enquiry has been received."
    );

    event.target.reset();
  };

  return (
    <section className="section">

      <div className="eyebrow">
        GET IN TOUCH
      </div>

      <h2>
        LET'S SECURE{" "}
        <span>
          YOUR SPACE.
        </span>
      </h2>

      <form
        className="contact-form"
        onSubmit={
          submit
        }
      >

        <input
          required
          placeholder="Name"
        />

        <input
          required
          type="email"
          placeholder="Email"
        />

        <input
          placeholder="Phone"
        />

        <textarea
          required
          placeholder="Tell us about your security requirement"
        />

        <button>
          SEND ENQUIRY →
        </button>

      </form>

    </section>
  );
}

/* =========================================================
   FAQ
   ========================================================= */

function FAQ() {
  const items = [
    [
      "Which access methods do KULUF locks support?",
      "Depending on the model, KULUF products can support fingerprint, PIN, RFID, mobile app and mechanical key access.",
    ],
    [
      "Can KULUF locks be installed professionally?",
      "Yes. Professional installation can be arranged for supported products and locations.",
    ],
    [
      "How do I choose the right lock?",
      "Choose based on door type, location, required access methods and the level of control you need.",
    ],
    [
      "Can businesses use KULUF access control?",
      "Yes. KULUF includes solutions for offices, commercial spaces and managed access environments.",
    ],
  ];

  return (
    <section className="section">

      <div className="eyebrow">
        SUPPORT
      </div>

      <h2>
        FREQUENTLY ASKED{" "}
        <span>
          QUESTIONS.
        </span>
      </h2>

      <div className="faq-list">

        {items.map(
          ([
            question,
            answer,
          ]) => (
            <details
              key={
                question
              }
            >

              <summary>
                {question}
              </summary>

              <p>
                {answer}
              </p>

            </details>
          )
        )}

      </div>

    </section>
  );
}

/* =========================================================
   CTA
   ========================================================= */

function CTA({
  title,
  text,
  navigate,
}) {
  return (
    <section className="cta">

      <div>

        <div className="eyebrow">
          KULUF TOTAL SECURITY
        </div>

        <h2>
          {title}
        </h2>

        <p>
          {text ||
            "Let's help you find the perfect security solution for your space."}
        </p>

      </div>

      <button
        onClick={() =>
          navigate(
            "/shop"
          )
        }
      >
        EXPLORE PRODUCTS →
      </button>

    </section>
  );
}

/* =========================================================
   FOOTER
   ========================================================= */

function Footer({
  navigate,
}) {
  const link = (
    event,
    path
  ) => {
    event.preventDefault();

    navigate(path);
  };

  return (
    <footer>

      <div className="footer-grid">

        <div>

          <div className="logo">
            KULUF

            <small>
              TOTAL SECURITY
            </small>

            <p>
              LOGISTICS |
              LOCKS |
              SAFER WORLD
            </p>
          </div>

        </div>

        <div>

          <b>
            Company
          </b>

          <a
            href="/about"
            onClick={(e) =>
              link(
                e,
                "/about"
              )
            }
          >
            About
          </a>

          <a
            href="/contact"
            onClick={(e) =>
              link(
                e,
                "/contact"
              )
            }
          >
            Services
          </a>

          <a
            href="/contact"
            onClick={(e) =>
              link(
                e,
                "/contact"
              )
            }
          >
            Solutions
          </a>

          <a
            href="/contact"
            onClick={(e) =>
              link(
                e,
                "/contact"
              )
            }
          >
            Contact
          </a>

        </div>

        <div>

          <b>
            Products
          </b>

          <a
            href="/shop"
            onClick={(e) =>
              link(
                e,
                "/shop"
              )
            }
          >
            Smart Door Locks
          </a>

          <a
            href="/shop"
            onClick={(e) =>
              link(
                e,
                "/shop"
              )
            }
          >
            Digital Locks
          </a>

          <a
            href="/shop"
            onClick={(e) =>
              link(
                e,
                "/shop"
              )
            }
          >
            Access Control
          </a>

        </div>

        <div>

          <b>
            Support
          </b>

          <a
            href="/faq"
            onClick={(e) =>
              link(
                e,
                "/faq"
              )
            }
          >
            FAQs
          </a>

          <a
            href="/contact"
            onClick={(e) =>
              link(
                e,
                "/contact"
              )
            }
          >
            Support
          </a>

        </div>

      </div>

      <div className="footer-bottom">
        © KULUF Total
        Security. All
        rights reserved.
      </div>

    </footer>
  );
}

/* =========================================================
   ADMIN
   ========================================================= */

function Admin({
  user,
  setUser,
  navigate,
}) {
  const [
    tab,
    setTab,
  ] = useState(
    "dashboard"
  );

  const [
    dashboard,
    setDashboard,
  ] = useState(null);

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    orders,
    setOrders,
  ] = useState([]);

  const [
    customers,
    setCustomers,
  ] = useState([]);

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    content,
    setContent,
  ] = useState({});

  const [
    editingProduct,
    setEditingProduct,
  ] = useState(null);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    heroFile,
    setHeroFile,
  ] = useState(null);

  const [
    heroPreview,
    setHeroPreview,
  ] = useState("");

  const [
    uploading,
    setUploading,
  ] = useState(false);

  /* -------------------------------------------------------
     NOTIFY
     ------------------------------------------------------- */

  const notify = (
    text
  ) => {
    setMessage(text);

    setTimeout(
      () =>
        setMessage(""),
      2500
    );
  };

  /* -------------------------------------------------------
     LOAD ADMIN DATA
     ------------------------------------------------------- */

  const load =
    async () => {
      try {
        const [
          dash,
          productData,
          orderData,
          customerData,
          contentData,
          categoryData,
        ] =
          await Promise.all(
            [
              api(
                "/api/admin/dashboard"
              ),
              api(
                "/api/admin/products"
              ),
              api(
                "/api/admin/orders"
              ),
              api(
                "/api/admin/customers"
              ),
              api(
                "/api/admin/content"
              ),
              api(
                "/api/admin/categories"
              ),
            ]
          );

        setDashboard(
          dash
        );

        setProducts(
          productData
        );

        setOrders(
          orderData
        );

        setCustomers(
          customerData
        );

        setContent(
          contentData
        );

        setCategories(
          categoryData
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        localStorage.removeItem(
          "kuluf_token"
        );

        setUser(
          null
        );

        navigate(
          "/login"
        );
      }
    };

  useEffect(() => {
    if (!user) {
      navigate(
        "/login"
      );

      return;
    }

    load();
  }, [user]);

  if (!dashboard) {
    return (
      <div className="admin-loading">
        LOADING ADMIN...
      </div>
    );
  }

  /* -------------------------------------------------------
     SAVE CONTENT
     ------------------------------------------------------- */

  const saveContent =
    async () => {
      try {
        await api(
          "/api/admin/content",
          {
            method:
              "PUT",
            body:
              JSON.stringify(
                content
              ),
          }
        );

        notify(
          "Website content saved."
        );
      } catch (
        error
      ) {
        alert(
          error.message
        );
      }
    };

  /* -------------------------------------------------------
     HERO UPLOAD
     ------------------------------------------------------- */

  const uploadHero =
    async () => {
      if (!heroFile) {
        alert(
          "Please choose an image first."
        );

        return;
      }

      const formData =
        new FormData();

      formData.append(
        "image",
        heroFile
      );

      setUploading(
        true
      );

      try {
        const result =
          await api(
            "/api/admin/content/hero-image",
            {
              method:
                "POST",
              body:
                formData,
            }
          );

        setContent(
          (old) => ({
            ...old,
            hero_image:
              result.url ||
              result.image ||
              "",
          })
        );

        setHeroFile(
          null
        );

        setHeroPreview(
          ""
        );

        notify(
          "Hero image uploaded."
        );

        await load();
      } catch (
        error
      ) {
        alert(
          error.message
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  /* -------------------------------------------------------
     REMOVE HERO
     ------------------------------------------------------- */

  const removeHero =
    async () => {
      if (
        !confirm(
          "Remove the current hero image?"
        )
      ) {
        return;
      }

      try {
        await api(
          "/api/admin/content/hero-image",
          {
            method:
              "DELETE",
          }
        );

        setContent(
          (old) => ({
            ...old,
            hero_image:
              "",
          })
        );

        setHeroFile(
          null
        );

        setHeroPreview(
          ""
        );

        notify(
          "Hero image removed."
        );

        await load();
      } catch (
        error
      ) {
        alert(
          error.message
        );
      }
    };

  /* -------------------------------------------------------
     ADD PRODUCT
     ------------------------------------------------------- */

  const addProduct =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        const form =
          new FormData(
            event.target
          );

        await api(
          "/api/admin/products",
          {
            method:
              "POST",
            body:
              form,
          }
        );

        await load();

        event.target.reset();

        setTab(
          "products"
        );

        notify(
          "Product added successfully."
        );
      } catch (
        error
      ) {
        alert(
          error.message
        );
      }
    };

  /* -------------------------------------------------------
     UPDATE PRODUCT
     ------------------------------------------------------- */

  const updateProduct =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !editingProduct
      ) {
        return;
      }

      try {
        const form =
          new FormData(
            event.target
          );

        await api(
          "/api/admin/products/" +
            editingProduct.id,
          {
            method:
              "PUT",
            body:
              form,
          }
        );

        await load();

        setEditingProduct(
          null
        );

        setTab(
          "products"
        );

        notify(
          "Product updated successfully."
        );
      } catch (
        error
      ) {
        alert(
          error.message ||
            "Could not update product."
        );
      }
    };

  /* -------------------------------------------------------
     DELETE PRODUCT
     ------------------------------------------------------- */

  const deleteProduct =
    async (
      id
    ) => {
      if (
        !confirm(
          "Delete this product?"
        )
      ) {
        return;
      }

      try {
        await api(
          "/api/admin/products/" +
            id,
          {
            method:
              "DELETE",
          }
        );

        await load();

        notify(
          "Product deleted."
        );
      } catch (
        error
      ) {
        alert(
          error.message
        );
      }
    };

  /* -------------------------------------------------------
     LOGOUT
     ------------------------------------------------------- */

  const logout =
    () => {
      localStorage.removeItem(
        "kuluf_token"
      );

      setUser(
        null
      );

      navigate(
        "/login"
      );
    };

  /* -------------------------------------------------------
     SIDEBAR
     ------------------------------------------------------- */

  const tabs = [
    "dashboard",
    "products",
    "add-product",
    "orders",
    "customers",
    "content",
  ];

  return (
    <div className="admin-shell">

      {/* SIDEBAR */}

      <aside>

        <div className="admin-logo">
          KULUF

          <small>
            ADMIN
          </small>
        </div>

        {tabs.map(
          (item) => (
            <button
              key={
                item
              }
              className={
                tab ===
                item
                  ? "active"
                  : ""
              }
              onClick={() =>
                setTab(
                  item
                )
              }
            >
              {item
                .replace(
                  "-",
                  " "
                )
                .toUpperCase()}
            </button>
          )
        )}

        <button
          onClick={
            logout
          }
        >
          LOG OUT
        </button>

      </aside>

      {/* MAIN */}

      <div className="admin-main">

        <div className="admin-top">

          <h1>
            {tab
              .replace(
                "-",
                " "
              )
              .toUpperCase()}
          </h1>

          <span>
            Protected Admin
          </span>

        </div>

        {message && (
          <div
            style={{
              padding:
                "14px 18px",
              background:
                "#52745d",
              color:
                "#fff",
              marginBottom:
                "20px",
              fontSize:
                "12px",
            }}
          >
            {message}
          </div>
        )}

        {/* =================================================
            DASHBOARD
            ================================================= */}

        {tab ===
          "dashboard" && (
          <>
            <div className="admin-stats">

              {[
                [
                  "REVENUE",
                  money(
                    dashboard.revenue
                  ),
                ],
                [
                  "ORDERS",
                  dashboard.orders,
                ],
                [
                  "CUSTOMERS",
                  dashboard.customers,
                ],
                [
                  "PRODUCTS",
                  dashboard.products,
                ],
                [
                  "LOW STOCK",
                  dashboard.lowStock,
                ],
              ].map(
                ([
                  label,
                  value,
                ]) => (
                  <div
                    key={
                      label
                    }
                  >
                    <small>
                      {label}
                    </small>

                    <b>
                      {value}
                    </b>
                  </div>
                )
              )}

            </div>

            <h2>
              Recent Orders
            </h2>

            <AdminTable
              rows={
                dashboard.recent ||
                []
              }
              cols={[
                "order_number",
                "name",
                "total",
                "order_status",
                "created_at",
              ]}
            />
          </>
        )}

        {/* =================================================
            PRODUCTS
            ================================================= */}

        {tab ===
          "products" && (
          <>
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "20px",
                marginBottom:
                  "25px",
                flexWrap:
                  "wrap",
              }}
            >

              <div>

                <div className="eyebrow">
                  PRODUCT MANAGEMENT
                </div>

                <h2>
                  PRODUCTS
                </h2>

              </div>

              <button
                onClick={() => {
                  setEditingProduct(
                    null
                  );

                  setTab(
                    "add-product"
                  );
                }}
              >
                + ADD PRODUCT
              </button>

            </div>

            <AdminTable
              rows={
                products
              }
              cols={[
                "name",
                "sku",
                "category_name",
                "price",
                "stock",
                "status",
              ]}
              actions={(
                row
              ) => (
                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "8px",
                    flexWrap:
                      "wrap",
                  }}
                >

                  {/* EDIT */}

                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(
                        row
                      );

                      setTab(
                        "edit-product"
                      );
                    }}
                  >
                    EDIT
                  </button>

                  {/* DELETE */}

                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      deleteProduct(
                        row.id
                      )
                    }
                  >
                    DELETE
                  </button>

                </div>
              )}
            />
          </>
        )}

        {/* =================================================
            ADD PRODUCT
            ================================================= */}

        {tab ===
          "add-product" && (
          <form
            className="admin-form"
            onSubmit={
              addProduct
            }
          >

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "20px",
                marginBottom:
                  "25px",
                flexWrap:
                  "wrap",
              }}
            >

              <div>

                <div className="eyebrow">
                  PRODUCT MANAGEMENT
                </div>

                <h2>
                  ADD NEW PRODUCT
                </h2>

              </div>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setTab(
                    "products"
                  )
                }
              >
                ← BACK
              </button>

            </div>

            <div className="cms-card">

              <label>
                <b>
                  PRODUCT NAME
                </b>

                <input
                  name="name"
                  required
                  placeholder="Product name"
                />
              </label>

              <label>
                <b>
                  SKU
                </b>

                <input
                  name="sku"
                  required
                  placeholder="SKU"
                />
              </label>

              <label>
                <b>
                  CATEGORY
                </b>

                <select
                  name="category_id"
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (
                      category
                    ) => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {
                          category.name
                        }
                      </option>
                    )
                  )}

                </select>
              </label>

              <label>
                <b>
                  SHORT DESCRIPTION
                </b>

                <textarea
                  name="short_description"
                  placeholder="Short description"
                />
              </label>

              <label>
                <b>
                  FULL DESCRIPTION
                </b>

                <textarea
                  name="description"
                  placeholder="Full description"
                />
              </label>

              <div className="two-col">

                <label>
                  <b>
                    PRICE
                  </b>

                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    required
                    placeholder="Price"
                  />
                </label>

                <label>
                  <b>
                    SALE PRICE
                  </b>

                  <input
                    name="sale_price"
                    type="number"
                    step="0.01"
                    placeholder="Sale price"
                  />
                </label>

              </div>

              <label>
                <b>
                  STOCK
                </b>

                <input
                  name="stock"
                  type="number"
                  defaultValue="0"
                />
              </label>

              <label>
                <b>
                  ACCESS METHODS
                </b>

                <input
                  name="access_methods"
                  placeholder="Fingerprint, PIN, RFID, Mobile App, Key"
                />
              </label>

              <label>
                <b>
                  SPECIFICATIONS
                </b>

                <textarea
                  name="specifications"
                  placeholder="Specifications"
                />
              </label>

              <div className="two-col">

                <label>
                  <b>
                    INSTALLATION
                  </b>

                  <input
                    name="installation"
                    placeholder="Installation"
                  />
                </label>

                <label>
                  <b>
                    BATTERY
                  </b>

                  <input
                    name="battery"
                    placeholder="Battery"
                  />
                </label>

              </div>

              <div className="two-col">

                <label>
                  <b>
                    MATERIAL
                  </b>

                  <input
                    name="material"
                    placeholder="Material"
                  />
                </label>

                <label>
                  <b>
                    BADGE
                  </b>

                  <input
                    name="badge"
                    placeholder="NEW / SALE / BESTSELLER"
                  />
                </label>

              </div>

              <label>
                <b>
                  PRODUCT IMAGES
                </b>

                <input
                  name="images"
                  type="file"
                  multiple
                  accept="image/*"
                />
              </label>

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "20px",
                  flexWrap:
                    "wrap",
                  marginBottom:
                    "20px",
                }}
              >

                <label
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap:
                      "8px",
                    margin:
                      "0",
                  }}
                >
                  <input
                    name="featured"
                    value="1"
                    type="checkbox"
                  />

                  Featured
                </label>

                <label
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap:
                      "8px",
                    margin:
                      "0",
                  }}
                >
                  <input
                    name="bestseller"
                    value="1"
                    type="checkbox"
                  />

                  Bestseller
                </label>

                <label
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap:
                      "8px",
                    margin:
                      "0",
                  }}
                >
                  <input
                    name="new_arrival"
                    value="1"
                    type="checkbox"
                  />

                  New Arrival
                </label>

              </div>

              <button>
                SAVE PRODUCT →
              </button>

            </div>

          </form>
        )}

        {/* =================================================
            EDIT PRODUCT
            ================================================= */}

        {tab ===
          "edit-product" &&
          editingProduct && (
            <form
              className="admin-form edit-product-form"
              onSubmit={
                updateProduct
              }
            >

              {/* EDIT HEADER */}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap:
                    "20px",
                  marginBottom:
                    "25px",
                  flexWrap:
                    "wrap",
                }}
              >

                <div>

                  <div className="eyebrow">
                    PRODUCT MANAGEMENT
                  </div>

                  <h2>
                    EDIT PRODUCT
                  </h2>

                  <p
                    style={{
                      color:
                        "#777",
                      marginTop:
                        "7px",
                    }}
                  >
                    Update your
                    product
                    information,
                    pricing,
                    stock and
                    images.
                  </p>

                </div>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditingProduct(
                      null
                    );

                    setTab(
                      "products"
                    );
                  }}
                >
                  ← BACK TO PRODUCTS
                </button>

              </div>

              {/* BASIC INFORMATION */}

              <div className="cms-card">

                <div className="eyebrow">
                  BASIC INFORMATION
                </div>

                <h2>
                  PRODUCT DETAILS
                </h2>

                <label>
                  <b>
                    PRODUCT NAME
                  </b>

                  <input
                    name="name"
                    required
                    defaultValue={
                      editingProduct.name ||
                      ""
                    }
                  />
                </label>

                <label>
                  <b>
                    SKU
                  </b>

                  <input
                    value={
                      editingProduct.sku ||
                      ""
                    }
                    readOnly
                    style={{
                      background:
                        "#f1f1f1",
                      cursor:
                        "not-allowed",
                    }}
                  />

                  <small
                    style={{
                      display:
                        "block",
                      marginTop:
                        "6px",
                      color:
                        "#777",
                    }}
                  >
                    SKU is
                    currently
                    locked and
                    cannot be
                    changed here.
                  </small>
                </label>

                <label>
                  <b>
                    CATEGORY
                  </b>

                  <select
                    name="category_id"
                    defaultValue={
                      editingProduct.category_id ||
                      ""
                    }
                  >

                    <option value="">
                      Select category
                    </option>

                    {categories.map(
                      (
                        category
                      ) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.name
                          }
                        </option>
                      )
                    )}

                  </select>
                </label>

                <label>
                  <b>
                    SHORT DESCRIPTION
                  </b>

                  <textarea
                    name="short_description"
                    rows="4"
                    defaultValue={
                      editingProduct.short_description ||
                      ""
                    }
                  />
                </label>

                <label>
                  <b>
                    FULL DESCRIPTION
                  </b>

                  <textarea
                    name="description"
                    rows="8"
                    defaultValue={
                      editingProduct.description ||
                      ""
                    }
                  />
                </label>

              </div>

              {/* PRICE AND STOCK */}

              <div className="cms-card">

                <div className="eyebrow">
                  PRICING & INVENTORY
                </div>

                <h2>
                  COMMERCIAL DETAILS
                </h2>

                <div className="two-col">

                  <label>
                    <b>
                      PRICE
                    </b>

                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={
                        editingProduct.price ??
                        ""
                      }
                    />
                  </label>

                  <label>
                    <b>
                      SALE PRICE
                    </b>

                    <input
                      name="sale_price"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        editingProduct.sale_price ??
                        ""
                      }
                    />
                  </label>

                  <label>
                    <b>
                      STOCK
                    </b>

                    <input
                      name="stock"
                      type="number"
                      min="0"
                      defaultValue={
                        editingProduct.stock ??
                        0
                      }
                    />
                  </label>

                  <label>
                    <b>
                      STATUS
                    </b>

                    <select
                      name="status"
                      defaultValue={
                        editingProduct.status ||
                        "active"
                      }
                    >
                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>
                    </select>
                  </label>

                </div>

                <label>
                  <b>
                    BADGE
                  </b>

                  <input
                    name="badge"
                    placeholder="NEW / SALE / BESTSELLER"
                    defaultValue={
                      editingProduct.badge ||
                      ""
                    }
                  />
                </label>

              </div>

              {/* SECURITY INFORMATION */}

              <div className="cms-card">

                <div className="eyebrow">
                  SECURITY DETAILS
                </div>

                <h2>
                  PRODUCT FEATURES
                </h2>

                <label>
                  <b>
                    ACCESS METHODS
                  </b>

                  <input
                    name="access_methods"
                    placeholder="Fingerprint, PIN, RFID, Mobile App, Key"
                    defaultValue={
                      editingProduct.access_methods ||
                      ""
                    }
                  />
                </label>

                <label>
                  <b>
                    SPECIFICATIONS
                  </b>

                  <textarea
                    name="specifications"
                    rows="7"
                    defaultValue={
                      editingProduct.specifications ||
                      ""
                    }
                  />
                </label>

                <div className="two-col">

                  <label>
                    <b>
                      INSTALLATION
                    </b>

                    <input
                      name="installation"
                      defaultValue={
                        editingProduct.installation ||
                        ""
                      }
                    />
                  </label>

                  <label>
                    <b>
                      BATTERY
                    </b>

                    <input
                      name="battery"
                      defaultValue={
                        editingProduct.battery ||
                        ""
                      }
                    />
                  </label>

                </div>

                <label>
                  <b>
                    MATERIAL
                  </b>

                  <input
                    name="material"
                    defaultValue={
                      editingProduct.material ||
                      ""
                    }
                  />
                </label>

              </div>

              {/* PRODUCT FLAGS */}

              <div className="cms-card">

                <div className="eyebrow">
                  STORE SETTINGS
                </div>

                <h2>
                  PRODUCT VISIBILITY
                </h2>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(3, 1fr)",
                    gap:
                      "12px",
                  }}
                >

                  <label
                    style={{
                      margin:
                        "0",
                      padding:
                        "15px",
                      border:
                        "1px solid #ddd",
                      background:
                        "#fafafa",
                    }}
                  >

                    <input
                      name="featured"
                      value="1"
                      type="checkbox"
                      defaultChecked={
                        Number(
                          editingProduct.featured
                        ) ===
                        1
                      }
                    />

                    <span
                      style={{
                        marginLeft:
                          "8px",
                      }}
                    >
                      Featured
                    </span>

                  </label>

                  <label
                    style={{
                      margin:
                        "0",
                      padding:
                        "15px",
                      border:
                        "1px solid #ddd",
                      background:
                        "#fafafa",
                    }}
                  >

                    <input
                      name="bestseller"
                      value="1"
                      type="checkbox"
                      defaultChecked={
                        Number(
                          editingProduct.bestseller
                        ) ===
                        1
                      }
                    />

                    <span
                      style={{
                        marginLeft:
                          "8px",
                      }}
                    >
                      Bestseller
                    </span>

                  </label>

                  <label
                    style={{
                      margin:
                        "0",
                      padding:
                        "15px",
                      border:
                        "1px solid #ddd",
                      background:
                        "#fafafa",
                    }}
                  >

                    <input
                      name="new_arrival"
                      value="1"
                      type="checkbox"
                      defaultChecked={
                        Number(
                          editingProduct.new_arrival
                        ) ===
                        1
                      }
                    />

                    <span
                      style={{
                        marginLeft:
                          "8px",
                      }}
                    >
                      New Arrival
                    </span>

                  </label>

                </div>

              </div>

              {/* PRODUCT IMAGES */}

              <div className="cms-card">

                <div className="eyebrow">
                  PRODUCT MEDIA
                </div>

                <h2>
                  PRODUCT IMAGES
                </h2>

                {editingProduct.images &&
                editingProduct
                  .images
                  .length >
                  0 ? (

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(150px, 1fr))",
                      gap:
                        "14px",
                      marginBottom:
                        "22px",
                    }}
                  >

                    {editingProduct.images.map(
                      (
                        image,
                        index
                      ) => (
                        <div
                          key={
                            image.id ||
                            image.url ||
                            index
                          }
                          style={{
                            aspectRatio:
                              "1",
                            overflow:
                              "hidden",
                            background:
                              "#eee",
                            border:
                              "1px solid #ddd",
                          }}
                        >

                          <img
                            src={
                              image.url
                            }
                            alt={
                              editingProduct.name ||
                              "Product"
                            }
                            style={{
                              width:
                                "100%",
                              height:
                                "100%",
                              objectFit:
                                "cover",
                              display:
                                "block",
                            }}
                          />

                        </div>
                      )
                    )}

                  </div>

                ) : (

                  <p
                    style={{
                      color:
                        "#777",
                    }}
                  >
                    No product
                    images
                    uploaded yet.
                  </p>

                )}

                <label>
                  <b>
                    ADD NEW IMAGES
                  </b>

                  <input
                    name="images"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  />
                </label>

                <small
                  style={{
                    display:
                      "block",
                    color:
                      "#777",
                    marginTop:
                      "-5px",
                  }}
                >
                  New images
                  will be
                  added to
                  the existing
                  gallery.
                </small>

              </div>

              {/* ACTION BUTTONS */}

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "12px",
                  flexWrap:
                    "wrap",
                  marginTop:
                    "10px",
                }}
              >

                <button
                  type="submit"
                >
                  UPDATE PRODUCT →
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditingProduct(
                      null
                    );

                    setTab(
                      "products"
                    );
                  }}
                >
                  CANCEL
                </button>

              </div>

            </form>
          )}

        {/* =================================================
            ORDERS
            ================================================= */}

        {tab ===
          "orders" && (
          <AdminTable
            rows={
              orders
            }
            cols={[
              "order_number",
              "name",
              "email",
              "total",
              "payment_status",
              "order_status",
              "created_at",
            ]}
            actions={(
              row
            ) => (
              <select
                value={
                  row.order_status
                }
                onChange={async (
                  event
                ) => {
                  try {
                    await api(
                      "/api/admin/orders/" +
                        row.id,
                      {
                        method:
                          "PUT",
                        body:
                          JSON.stringify(
                            {
                              status:
                                event
                                  .target
                                  .value,
                              payment_status:
                                row.payment_status,
                            }
                          ),
                      }
                    );

                    await load();

                    notify(
                      "Order updated."
                    );
                  } catch (
                    error
                  ) {
                    alert(
                      error.message
                    );
                  }
                }}
              >

                {[
                  "Pending Payment",
                  "Confirmed",
                  "Processing",
                  "Packed",
                  "Shipped",
                  "Out for Delivery",
                  "Delivered",
                  "Cancelled",
                  "Refunded",
                ].map(
                  (
                    status
                  ) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {
                        status
                      }
                    </option>
                  )
                )}

              </select>
            )}
          />
        )}

        {/* =================================================
            CUSTOMERS
            ================================================= */}

        {tab ===
          "customers" && (
          <AdminTable
            rows={
              customers
            }
            cols={[
              "name",
              "email",
              "phone",
              "orders",
              "total_spent",
              "created_at",
            ]}
          />
        )}

        {/* =================================================
            WEBSITE CONTENT
            ================================================= */}

        {tab ===
          "content" && (
          <WebsiteContentEditor
            content={
              content
            }
            setContent={
              setContent
            }
            heroFile={
              heroFile
            }
            setHeroFile={
              setHeroFile
            }
            heroPreview={
              heroPreview
            }
            setHeroPreview={
              setHeroPreview
            }
            uploading={
              uploading
            }
            uploadHero={
              uploadHero
            }
            removeHero={
              removeHero
            }
            saveContent={
              saveContent
            }
          />
        )}

      </div>
    </div>
  );
}

/* =========================================================
   WEBSITE CONTENT EDITOR
   ========================================================= */

function WebsiteContentEditor({
  content = {},
  setContent,
  heroFile,
  setHeroFile,
  heroPreview,
  setHeroPreview,
  uploading,
  uploadHero,
  removeHero,
  saveContent,
}) {
  const [carouselFiles, setCarouselFiles] = useState({});
  const [carouselPreviews, setCarouselPreviews] = useState({});
  const [carouselUploading, setCarouselUploading] = useState({});
  const [activeSlide, setActiveSlide] = useState(1);
  const [draggingSlide, setDraggingSlide] = useState(null);
  const [notice, setNotice] = useState("");

  const update = (key, value) => {
    setContent((old) => ({ ...old, [key]: value }));
  };

  const chooseCarouselImage = (number, file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Please choose an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotice("Images must be 10MB or smaller.");
      return;
    }

    setCarouselFiles((old) => ({ ...old, [number]: file }));
    setCarouselPreviews((old) => ({
      ...old,
      [number]: URL.createObjectURL(file),
    }));

    setNotice(
      `Slide ${number}: preview ready. Upload the image to store it on the server.`
    );
  };

  const uploadCarouselImage = async (number) => {
    const file = carouselFiles[number];

    if (!file) {
      setNotice(`Choose an image for Slide ${number} first.`);
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("slide", String(number));

    setCarouselUploading((old) => ({ ...old, [number]: true }));
    setNotice("");

    try {
      const result = await api(
        `/api/admin/content/carousel-image/${number}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const imageUrl = result.url || result.image || result.imageUrl;

      if (!imageUrl) {
        throw new Error(
          "The server did not return an image URL after uploading."
        );
      }

      update(`carousel_${number}_image`, imageUrl);

      setCarouselFiles((old) => ({ ...old, [number]: null }));
      setCarouselPreviews((old) => ({ ...old, [number]: "" }));

      setNotice(
        `Slide ${number} image uploaded. Click Save Website Content to save your edits.`
      );
    } catch (error) {
      setNotice(
        error.message ||
          `Could not upload Slide ${number}. Check your backend upload route.`
      );
    } finally {
      setCarouselUploading((old) => ({
        ...old,
        [number]: false,
      }));
    }
  };

  const field = (key, label, description, options = {}) => (
    <label className="kuluf-field" key={key}>
      <span className="kuluf-field-label">{label}</span>

      {description && (
        <span className="kuluf-field-help">{description}</span>
      )}

      {options.multiline ? (
        <textarea
          rows={options.rows || 3}
          value={content[key] || ""}
          placeholder={options.placeholder || "Write here…"}
          onChange={(event) => update(key, event.target.value)}
        />
      ) : (
        <input
          type="text"
          value={content[key] || ""}
          placeholder={options.placeholder || "Enter text…"}
          onChange={(event) => update(key, event.target.value)}
        />
      )}
    </label>
  );

  const sectionFields = [
    ["benefit_1_number", "Benefit 1 — Number", "Number shown in the first benefit."],
    ["benefit_1_text", "Benefit 1 — Text", "Description shown beside the first benefit number."],
    ["benefit_2_number", "Benefit 2 — Number", "Number shown in the second benefit."],
    ["benefit_2_text", "Benefit 2 — Text", "Description shown beside the second benefit number."],
    ["benefit_3_number", "Benefit 3 — Number", "Number shown in the third benefit."],
    ["benefit_3_text", "Benefit 3 — Text", "Description shown beside the third benefit number."],
    ["benefit_4_number", "Benefit 4 — Number", "Number shown in the fourth benefit."],
    ["benefit_4_text", "Benefit 4 — Text", "Description shown beside the fourth benefit number."],
    ["categories_label", "Categories — Small Label", "Small label above the categories heading."],
    ["categories_title", "Categories — Heading", "Main heading above homepage categories."],
    ["categories_description", "Categories — Description", "Supporting text below the categories heading."],
    ["products_label", "Featured Products — Small Label", "Small label above featured products."],
    ["products_title", "Featured Products — Heading", "Main featured products heading."],
    ["tech_label", "Technology — Small Label", "Small label above the technology section."],
    ["tech_title", "Technology — First Heading", "First part of the technology heading."],
    ["tech_title_second", "Technology — Second Heading", "Second part of the technology heading."],
    ["tech_description", "Technology — Description", "Supporting technology section paragraph."],
    ["lifestyle_label", "Lifestyle — Small Label", "Small label above the lifestyle carousel."],
    ["lifestyle_title", "Lifestyle — Heading", "Main lifestyle carousel heading."],
    ["lifestyle_description", "Lifestyle — Description", "Supporting lifestyle section text."],
    ["lifestyle_button", "Lifestyle — Button Text", "Text on the lifestyle section button."],
    ["lifestyle_link", "Lifestyle — Button Destination", "Path opened by the lifestyle button."],
    ["process_label", "Process — Small Label", "Small label above the process section."],
    ["process_title", "Process — Heading", "Main how-it-works heading."],
    ["step_1_title", "Step 1 — Heading", "Title of the first process step."],
    ["step_1_text", "Step 1 — Description", "Description of the first process step."],
    ["step_2_title", "Step 2 — Heading", "Title of the second process step."],
    ["step_2_text", "Step 2 — Description", "Description of the second process step."],
    ["step_3_title", "Step 3 — Heading", "Title of the third process step."],
    ["step_3_text", "Step 3 — Description", "Description of the third process step."],
    ["step_4_title", "Step 4 — Heading", "Title of the fourth process step."],
    ["step_4_text", "Step 4 — Description", "Description of the fourth process step."],
    ["cta_title", "Final CTA — Heading", "Heading in the final call-to-action section."],
    ["cta_description", "Final CTA — Description", "Supporting text under the final CTA heading."],
  ];

  return (
    <div className="kuluf-cms">
      <style>{`
        .kuluf-cms {
          --ink: #171714;
          --muted: #77766f;
          --gold: #b89a62;
          --line: rgba(23,23,20,.12);
          color: var(--ink);
          max-width: 1180px;
          margin: 0 auto;
          padding: 8px 0 48px;
          animation: kfEnter .55s ease both;
        }

        .kuluf-cms * {
          box-sizing: border-box;
        }

        .kuluf-cms .cms-hero {
          position: relative;
          overflow: hidden;
          background: linear-gradient(125deg,#171714 0%,#282720 55%,#3a3327 100%);
          color: #f7f3ea;
          border-radius: 22px;
          padding: clamp(25px,5vw,54px);
          margin-bottom: 24px;
          box-shadow: 0 18px 45px #17171418;
        }

        .kuluf-cms .cms-hero:after {
          content: "";
          position: absolute;
          width: 280px;
          height: 280px;
          border: 1px solid #c5a66b44;
          border-radius: 50%;
          right: -70px;
          top: -100px;
          box-shadow: 0 0 0 28px #c5a66b0c, 0 0 0 58px #c5a66b08;
          pointer-events: none;
        }

        .kuluf-cms .cms-kicker {
          font-size: 10px;
          letter-spacing: 3px;
          font-weight: 800;
          color: #d7bd89;
          text-transform: uppercase;
        }

        .kuluf-cms .cms-hero h1 {
          font-size: clamp(30px,4vw,48px);
          line-height: 1.04;
          letter-spacing: -1.8px;
          margin: 13px 0 12px;
          font-weight: 650;
          max-width: 680px;
        }

        .kuluf-cms .cms-hero p {
          max-width: 650px;
          color: #c9c5bb;
          line-height: 1.7;
          margin: 0;
          font-size: 14px;
        }

        .kuluf-cms .cms-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 20px;
        }

        .kuluf-cms .cms-card {
          background: #fffdf8;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: clamp(18px,3vw,28px);
          margin-bottom: 20px;
          box-shadow: 0 5px 18px #17171405;
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
          animation: kfCard .45s ease both;
        }

        .kuluf-cms .cms-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 35px #1717140d;
          border-color: #b89a6255;
        }

        .kuluf-cms .cms-card-head {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 22px;
        }

        .kuluf-cms .cms-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: grid;
          place-items: center;
          background: #f0e8d9;
          color: #80683d;
          border-radius: 13px;
          font-size: 18px;
        }

        .kuluf-cms .cms-kicker-light {
          font-size: 10px;
          letter-spacing: 2px;
          color: #92764a;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .kuluf-cms h2 {
          font-size: 22px;
          line-height: 1.2;
          letter-spacing: -.6px;
          margin: 0;
          font-weight: 700;
        }

        .kuluf-cms h3 {
          font-size: 16px;
          margin: 0;
          font-weight: 700;
        }

        .kuluf-cms .cms-desc {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.7;
          margin: 8px 0 0;
        }

        .kuluf-cms .kuluf-field {
          display: block;
          margin-bottom: 17px;
          min-width: 0;
        }

        .kuluf-cms .kuluf-field-label {
          display: block;
          font-size: 12px;
          font-weight: 750;
          letter-spacing: .1px;
          margin-bottom: 6px;
        }

        .kuluf-cms .kuluf-field-help {
          display: block;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.55;
          margin-bottom: 8px;
        }

        .kuluf-cms input:not([type=file]),
        .kuluf-cms textarea {
          width: 100%;
          border: 1px solid #dedbd2;
          border-radius: 10px;
          padding: 12px 13px;
          background: #fff;
          color: #222;
          font: inherit;
          font-size: 13px;
          outline: none;
          transition: border-color .2s, box-shadow .2s, background .2s;
        }

        .kuluf-cms input:focus,
        .kuluf-cms textarea:focus {
          border-color: #b89a62;
          box-shadow: 0 0 0 3px #b89a621c;
          background: #fffefa;
        }

        .kuluf-cms textarea {
          resize: vertical;
          min-height: 75px;
          line-height: 1.55;
        }

        .kuluf-cms .cms-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid #171714;
          background: #171714;
          color: #f9f5ec;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 11px;
          letter-spacing: .7px;
          font-weight: 800;
          cursor: pointer;
          transition: transform .2s, background .2s, box-shadow .2s;
        }

        .kuluf-cms .cms-btn:hover {
          transform: translateY(-2px);
          background: #39362e;
          box-shadow: 0 8px 18px #17171420;
        }

        .kuluf-cms .cms-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .kuluf-cms .cms-btn-light {
          background: #fffdf8;
          color: #25241f;
          border-color: #d9d3c7;
        }

        .kuluf-cms .cms-btn-light:hover {
          background: #f3ecdf;
          color: #25241f;
        }

        .kuluf-cms .cms-notice {
          padding: 13px 15px;
          background: #f1eadb;
          border: 1px solid #e0d1b2;
          color: #5b4a2b;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.5;
          margin: 0 0 20px;
          animation: kfEnter .25s ease both;
        }

        .kuluf-cms .cms-image-frame {
          position: relative;
          background: #171714;
          border-radius: 14px;
          overflow: hidden;
          min-height: 170px;
          margin-bottom: 14px;
          isolation: isolate;
        }

        .kuluf-cms .cms-image-frame img {
          width: 100%;
          height: 250px;
          display: block;
          object-fit: cover;
          transition: transform .65s cubic-bezier(.2,.7,.2,1), opacity .3s;
        }

        .kuluf-cms .cms-image-frame:hover img {
          transform: scale(1.035);
        }

        .kuluf-cms .cms-image-overlay {
          position: absolute;
          left: 12px;
          bottom: 12px;
          padding: 7px 10px;
          background: #111b;
          color: #fff;
          border: 1px solid #ffffff30;
          border-radius: 8px;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          backdrop-filter: blur(8px);
        }

        .kuluf-cms .cms-drop {
          border: 1px dashed #c6b58f;
          background: #f8f4eb;
          border-radius: 13px;
          padding: 18px;
          text-align: center;
          transition: background .2s, border-color .2s, transform .2s;
        }

        .kuluf-cms .cms-drop.is-dragging {
          background: #efe2c8;
          border-color: #947442;
          transform: scale(1.01);
        }

        .kuluf-cms .cms-drop input {
          max-width: 100%;
          font-size: 11px;
        }

        .kuluf-cms .cms-slide-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 18px 0 20px;
        }

        .kuluf-cms .cms-slide-tab {
          border: 1px solid #ddd5c6;
          background: #fffdf8;
          color: #6e6759;
          padding: 9px 13px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all .2s;
        }

        .kuluf-cms .cms-slide-tab.active {
          background: #201f1a;
          color: #f8f2e7;
          border-color: #201f1a;
          box-shadow: 0 5px 12px #17171418;
        }

        .kuluf-cms .cms-slide-layout {
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1.15fr);
          gap: 24px;
          align-items: start;
        }

        .kuluf-cms .cms-savebar {
          position: sticky;
          bottom: 12px;
          z-index: 5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          background: #fdfbf5ed;
          border: 1px solid #d8d0c0;
          border-radius: 16px;
          padding: 13px 15px;
          box-shadow: 0 12px 35px #1717141a;
          backdrop-filter: blur(14px);
          margin-top: 22px;
        }

        .kuluf-cms .cms-savebar span {
          font-size: 12px;
          color: #6f6a5e;
        }

        @keyframes kfEnter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes kfCard {
          from { opacity: 0; transform: translateY(9px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 760px) {
          .kuluf-cms .cms-grid,
          .kuluf-cms .cms-slide-layout {
            grid-template-columns: 1fr;
          }

          .kuluf-cms .cms-savebar {
            position: static;
            align-items: stretch;
            flex-direction: column;
          }

          .kuluf-cms .cms-savebar .cms-btn {
            width: 100%;
          }

          .kuluf-cms .cms-image-frame img {
            height: 210px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kuluf-cms,
          .kuluf-cms * {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <header className="cms-hero">
        <div className="cms-kicker">KULUF · DIGITAL EXPERIENCE</div>

        <h1>
          Website content,
          <br />
          beautifully controlled.
        </h1>

        <p>
          Update the message, hero, carousel imagery and section copy from one
          refined workspace. Preview images before uploading and save your
          edits when ready.
        </p>
      </header>

      {notice && (
        <div className="cms-notice" role="status">
          {notice}
        </div>
      )}

      {/* IMPORTANT NOTICE */}
      <section className="cms-card">
        <div className="cms-card-head">
          <div className="cms-icon">✦</div>

          <div>
            <div className="cms-kicker-light">Site-wide message</div>
            <h2>Important notice</h2>
            <p className="cms-desc">
              The announcement visitors see across the site.
            </p>
          </div>
        </div>

        {field(
          "important_notice",
          "Notice text",
          "Keep this short and useful. Leave it empty if no announcement is needed.",
          {
            multiline: true,
            rows: 2,
            placeholder: "e.g. Explore our latest smart security range",
          }
        )}
      </section>

      {/* HERO IMAGE EDITOR */}
      <section className="cms-card">
        <div className="cms-card-head">
          <div className="cms-icon">▧</div>

          <div>
            <div className="cms-kicker-light">Homepage · Section 01</div>
            <h2>Hero image</h2>
            <p className="cms-desc">
              Choose the large visual that introduces KULUF to visitors.
            </p>
          </div>
        </div>

        {heroPreview || content.hero_image ? (
          <div className="cms-image-frame">
            <img
              src={heroPreview || content.hero_image}
              alt="Homepage hero preview"
            />
            <span className="cms-image-overlay">Hero image preview</span>
          </div>
        ) : (
          <div className="cms-drop" style={{ marginBottom: 14 }}>
            No hero image selected yet.
          </div>
        )}

        <div className="cms-drop">
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            CHOOSE A REPLACEMENT IMAGE
          </div>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;

              if (!file.type.startsWith("image/")) {
                setNotice("Please choose an image file.");
                return;
              }

              if (file.size > 10 * 1024 * 1024) {
                setNotice("Images must be 10MB or smaller.");
                event.target.value = "";
                return;
              }

              setHeroFile(file);
              setHeroPreview(URL.createObjectURL(file));
              setNotice(
                "Hero preview ready. Upload the image to store it on the server."
              );
            }}
          />

          <p className="cms-desc">
            JPG, PNG, WebP, GIF or SVG · 10MB maximum
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <button
            className="cms-btn"
            type="button"
            disabled={!heroFile || uploading}
            onClick={uploadHero}
          >
            {uploading ? "UPLOADING…" : "↑ UPLOAD HERO IMAGE"}
          </button>

          {content.hero_image && (
            <button
              className="cms-btn cms-btn-light"
              type="button"
              onClick={removeHero}
            >
              Remove current image
            </button>
          )}
        </div>
      </section>

      {/* CAROUSEL IMAGE AND TEXT EDITOR */}
      <section className="cms-card">
        <div className="cms-card-head">
          <div className="cms-icon">▤</div>

          <div>
            <div className="cms-kicker-light">
              Homepage · Lifestyle carousel
            </div>
            <h2>Carousel studio</h2>
            <p className="cms-desc">
              Choose a slide, replace its image, and edit its text and button.
              Each slide has a separate image.
            </p>
          </div>
        </div>

        <div
          className="cms-slide-tabs"
          role="tablist"
          aria-label="Carousel slides"
        >
          {[1, 2, 3].map((number) => (
            <button
              key={number}
              type="button"
              role="tab"
              aria-selected={activeSlide === number}
              className={`cms-slide-tab ${
                activeSlide === number ? "active" : ""
              }`}
              onClick={() => setActiveSlide(number)}
            >
              0{number} · Slide {number}
            </button>
          ))}
        </div>

        {[1, 2, 3]
          .filter((number) => number === activeSlide)
          .map((number) => {
            const image =
              carouselPreviews[number] ||
              content[`carousel_${number}_image`];

            return (
              <div key={number} className="cms-slide-layout">
                <div>
                  <div className="cms-image-frame">
                    {image ? (
                      <img
                        src={image}
                        alt={`Carousel slide ${number} preview`}
                      />
                    ) : (
                      <div
                        style={{
                          minHeight: 210,
                          display: "grid",
                          placeItems: "center",
                          color: "#b8b2a6",
                          padding: 24,
                          textAlign: "center",
                        }}
                      >
                        Choose an image to preview Slide {number}
                      </div>
                    )}

                    <span className="cms-image-overlay">
                      Slide 0{number}
                    </span>
                  </div>

                  <div
                    className={`cms-drop ${
                      draggingSlide === number ? "is-dragging" : ""
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDraggingSlide(number);
                    }}
                    onDragLeave={() => setDraggingSlide(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDraggingSlide(null);
                      chooseCarouselImage(
                        number,
                        event.dataTransfer.files?.[0]
                      );
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        marginBottom: 7,
                      }}
                    >
                      {draggingSlide === number
                        ? "DROP IMAGE TO PREVIEW"
                        : "REPLACE SLIDE IMAGE"}
                    </div>

                    <p
                      className="cms-desc"
                      style={{ margin: "0 0 12px" }}
                    >
                      Drag an image here or select a file from your device.
                    </p>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      onChange={(event) =>
                        chooseCarouselImage(
                          number,
                          event.target.files?.[0]
                        )
                      }
                    />

                    <p className="cms-desc" style={{ marginBottom: 0 }}>
                      Image files up to 10MB
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 9,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    <button
                      className="cms-btn"
                      type="button"
                      disabled={
                        !carouselFiles[number] ||
                        !!carouselUploading[number]
                      }
                      onClick={() => uploadCarouselImage(number)}
                    >
                      {carouselUploading[number]
                        ? "UPLOADING…"
                        : "↑ UPLOAD SLIDE IMAGE"}
                    </button>

                    <button
                      className="cms-btn cms-btn-light"
                      type="button"
                      onClick={() => {
                        setCarouselFiles((old) => ({
                          ...old,
                          [number]: null,
                        }));

                        setCarouselPreviews((old) => ({
                          ...old,
                          [number]: "",
                        }));

                        setNotice(
                          `Local preview cleared for Slide ${number}. The saved image has not been changed.`
                        );
                      }}
                    >
                      Clear preview
                    </button>
                  </div>

                  <p className="cms-desc">
                    Current saved path:{" "}
                    <code>
                      {content[`carousel_${number}_image`] ||
                        "No image path saved"}
                    </code>
                  </p>
                </div>

                <div>
                  {field(
                    `carousel_${number}_image`,
                    `Slide ${number} — Image URL/path`,
                    "Use an existing image path, or upload a new image.",
                    { placeholder: "/uploads/carousel-image.jpg" }
                  )}

                  {field(
                    `carousel_${number}_eyebrow`,
                    `Slide ${number} — Small label`,
                    "Small text above the main heading."
                  )}

                  {field(
                    `carousel_${number}_title`,
                    `Slide ${number} — Main heading`,
                    "The main headline displayed on this slide.",
                    { multiline: true, rows: 2 }
                  )}

                  {field(
                    `carousel_${number}_highlight`,
                    `Slide ${number} — Highlighted text`,
                    "The phrase styled as the heading highlight."
                  )}

                  {field(
                    `carousel_${number}_description`,
                    `Slide ${number} — Description`,
                    "Supporting copy displayed with this image.",
                    { multiline: true, rows: 3 }
                  )}

                  <div className="cms-grid">
                    {field(
                      `carousel_${number}_button`,
                      `Slide ${number} — Button text`,
                      "Text on the slide button."
                    )}

                    {field(
                      `carousel_${number}_link`,
                      `Slide ${number} — Button destination`,
                      "Website path or URL opened by the button.",
                      { placeholder: "/products" }
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </section>

      {/* HOMEPAGE TEXT FIELDS */}
      <section className="cms-card">
        <div className="cms-card-head">
          <div className="cms-icon">✎</div>

          <div>
            <div className="cms-kicker-light">
              Homepage · Content
            </div>
            <h2>Section headings &amp; copy</h2>
            <p className="cms-desc">
              Every field tells you which part of the homepage it edits.
              Product listings and categories remain managed in their own
              admin sections.
            </p>
          </div>
        </div>

        <div className="cms-grid">
          {sectionFields.map(([key, label, description]) =>
            field(key, label, description, {
              multiline:
                key.includes("description") ||
                key.endsWith("_text") ||
                key.includes("title"),
              rows: 2,
            })
          )}
        </div>
      </section>

      {/* OTHER IMAGE PATHS */}
      <section className="cms-card">
        <div className="cms-card-head">
          <div className="cms-icon">▧</div>

          <div>
            <div className="cms-kicker-light">
              Additional website imagery
            </div>
            <h2>Other image paths</h2>
            <p className="cms-desc">
              Update paths for lifestyle and About page imagery. The file
              must already exist on your server.
            </p>
          </div>
        </div>

        <div className="cms-grid">
          {[
            [
              "lifestyle_image",
              "Lifestyle section image",
              "Image used by the lifestyle section.",
            ],
            [
              "about_hero_image",
              "About page hero image",
              "Main image on the About page.",
            ],
            [
              "about_story_image",
              "About page story image",
              "Image used in the About page story section.",
            ],
          ].map(([key, label, description]) => (
            <div key={key}>
              {field(key, label, description, {
                placeholder: "/uploads/your-image.jpg",
              })}

              {content[key] && (
                <div className="cms-image-frame">
                  <img src={content[key]} alt={`${label} preview`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* STICKY SAVE BAR */}
      <div className="cms-savebar">
        <span>
          Remember to save your text and image paths after uploading.
        </span>

        <button
          className="cms-btn"
          type="button"
          onClick={saveContent}
        >
          SAVE WEBSITE CONTENT →
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN TABLE
   ========================================================= */

function AdminTable({
  rows = [],
  cols = [],
  actions,
}) {
  return (
    <div className="table-wrap">

      <table>

        <thead>

          <tr>

            {cols.map(
              (
                column
              ) => (
                <th
                  key={
                    column
                  }
                >
                  {column
                    .replaceAll(
                      "_",
                      " "
                    )
                    .toUpperCase()}
                </th>
              )
            )}

            {actions && (
              <th>
                ACTIONS
              </th>
            )}

          </tr>

        </thead>

        <tbody>

          {rows.map(
            (
              row,
              index
            ) => (
              <tr
                key={
                  row.id ||
                  index
                }
              >

                {cols.map(
                  (
                    column
                  ) => (
                    <td
                      key={
                        column
                      }
                    >

                      {[
                        "price",
                        "total",
                        "total_spent",
                      ].includes(
                        column
                      )
                        ? money(
                            row[
                              column
                            ]
                          )
                        : row[
                            column
                          ] ??
                          "—"}

                    </td>
                  )
                )}

                {actions && (
                  <td>
                    {actions(
                      row
                    )}
                  </td>
                )}

              </tr>
            )
          )}

        </tbody>

      </table>

    </div>
  );
}

/* =========================================================
   LOADER
   ========================================================= */

function Loader() {
  return (
    <div className="loader">
      LOADING...
    </div>
  );
}

/* =========================================================
   NOT FOUND
   ========================================================= */

function NotFound({
  navigate,
}) {
  return (
    <section className="section empty">

      <h1>
        404
      </h1>

      <p>
        Page not found.
      </p>

      <button
        onClick={() =>
          navigate("/")
        }
      >
        BACK HOME →
      </button>

    </section>
  );
}

/* =========================================================
   ADMIN EXTRA STYLES
   ========================================================= */

const adminStyles = `
.admin-form {
  max-width: 1050px;
}

.admin-form label {
  display: block;
  margin-bottom: 18px;
}

.admin-form label b {
  display: block;
  margin-bottom: 7px;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.admin-form input,
.admin-form textarea,
.admin-form select {
  width: 100%;
  padding: 13px 14px;
  border: 1px solid #d8d8d8;
  background: #fff;
  color: #111;
  font: inherit;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.admin-form textarea {
  min-height: 90px;
  resize: vertical;
}

.admin-form input:focus,
.admin-form textarea:focus,
.admin-form select:focus {
  border-color: #c9a15c;
}

.admin-form input[type="file"] {
  cursor: pointer;
}

.cms-card {
  background: #fff;
  border: 1px solid #dedede;
  padding: 28px;
  margin-bottom: 24px;
}

.cms-card h2 {
  margin-top: 5px;
  margin-bottom: 25px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.admin-form button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.admin-form .secondary,
.admin-shell .secondary {
  background: #eee !important;
  color: #111 !important;
}

.edit-product-form {
  padding-bottom: 60px;
}

@media (max-width: 800px) {
  .two-col {
    grid-template-columns: 1fr;
  }

  .cms-card {
    padding: 20px;
  }

  .edit-product-form
    [style*="repeat(3"] {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 600px) {
  .admin-form {
    max-width: 100%;
  }

  .cms-card {
    padding: 16px;
  }
}
`;

function AdminStyles() {
  useEffect(() => {
    const style =
      document.createElement(
        "style"
      );

    style.dataset.kulufAdmin =
      "true";

    style.textContent =
      adminStyles;

    document.head.appendChild(
      style
    );

    return () =>
      style.remove();
  }, []);

  return null;
}

/* =========================================================
   START APPLICATION
   ========================================================= */

createRoot(
  document.getElementById(
    "root"
  )
).render(
  <React.StrictMode>
    <AdminStyles />
    <App />
  </React.StrictMode>
);